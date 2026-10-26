import { ehAdministradorNacional, escolasChefiadas } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { REGIONAIS, regionalDaUf } from "@/lib/event-policy";
import { relatorioCampanha } from "@/lib/avaliacao";
import type { ResumoFilialDados } from "@/lib/mercurio-db/resumo-filial";
import type { ResumoProfissoes } from "@/lib/mercurio-db/resumo-profissoes";
import { Prisma, type Member } from "@prisma/client";

/**
 * Panorama da filial e dos níveis maiores (pedido do usuário 2026-10-25: "já temos a visão da filial, apenas
 * expanda para níveis maiores" e "distribua os índices por área, não foque tanto em economia"). Os mesmos
 * indicadores para uma filial, uma regional ou todas: soma os resumos diários do Mercúrio (ResumoFilial) e
 * os números do Portal das filiais escolhidas. Só leitura; quem pode ver cada alcance é decidido em alcancesDaPessoa.
 */

/** Filial aberta no Portal, ou unidade do Mercúrio ainda fora dele (`foraDoPortal`, id "uni:<unidade>"). */
export type Escola = { id: string; nome: string; uf: string | null; unidade: string | null; foraDoPortal?: boolean };
export type Alcance = { chave: string; rotulo: string; escolas: Escola[] };

const nomeCurto = (n: string) => n.replace(/^Nova Acrópole\s*-\s*/i, "");

/** Alcances que a pessoa pode ver: a própria filial, as que chefia e, para a administração nacional, regionais e todas. */
export async function alcancesDaPessoa(m: Member): Promise<{ escolas: Escola[]; alcances: Alcance[]; nacional: boolean }> {
  const nacional = await ehAdministradorNacional(m);
  const ids = nacional ? null : [...new Set([m.schoolId, ...(await escolasChefiadas(m))])];
  const escolas: Escola[] = (
    await db.school.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, name: true, uf: true, mercurioUnidade: true }, orderBy: { name: "asc" } })
  ).map((s) => ({ id: s.id, nome: nomeCurto(s.name), uf: s.uf, unidade: s.mercurioUnidade }));
  // Administração nacional: também as unidades da OINAB-N ainda fora do Portal (pedido do usuário 2026-10-25).
  if (nacional) {
    const prof = await db.resumoNacional.findUnique({ where: { chave: "profissoes" }, select: { dados: true } });
    const doPortal = new Set(escolas.map((e) => e.unidade));
    for (const u of (prof?.dados as unknown as ResumoProfissoes | undefined)?.unidades ?? []) {
      if (!doPortal.has(u.id)) escolas.push({ id: `uni:${u.id}`, nome: nomeCurto(u.nome || u.cidade || u.id), uf: u.uf || null, unidade: u.id, foraDoPortal: true });
    }
    escolas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  const alcances: Alcance[] = escolas.map((e) => ({ chave: e.id, rotulo: e.nome, escolas: [e] }));
  if (nacional) {
    for (const [id, r] of Object.entries(REGIONAIS)) {
      const doRegional = escolas.filter((e) => regionalDaUf(e.uf) === id);
      if (doRegional.length > 1) alcances.push({ chave: `regional-${id}`, rotulo: `Regional ${r.nome}`, escolas: doRegional });
    }
    alcances.push({ chave: "todas", rotulo: "Todas as filiais", escolas });
  }
  return { escolas, alcances, nacional };
}

/** Filiais por regional e estado, para o seletor da Visão geral. */
export function gruposPorRegiao(escolas: Escola[]) {
  const nomeRegional = (id: string | null) => (id && REGIONAIS[id] ? `Regional ${REGIONAIS[id].nome}` : "Outras");
  const mapa = new Map<string, { id: string; nome: string; estados: Map<string, { uf: string; escolas: { id: string; nome: string }[] }> }>();
  for (const e of escolas) {
    const rid = regionalDaUf(e.uf) ?? "outras";
    const g = mapa.get(rid) ?? { id: rid, nome: nomeRegional(regionalDaUf(e.uf)), estados: new Map() };
    const uf = e.uf ?? "—";
    const est = g.estados.get(uf) ?? { uf, escolas: [] };
    est.escolas.push({ id: e.id, nome: e.nome });
    g.estados.set(uf, est);
    mapa.set(rid, g);
  }
  return [...mapa.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((g) => ({ id: g.id, nome: g.nome, estados: [...g.estados.values()].sort((a, b) => a.uf.localeCompare(b.uf)) }));
}

/**
 * Alcance escolhido: `filiais=id,id` (várias, do seletor), `alcance=<chave>` (filial, regional ou todas) ou,
 * sem nada, a própria filial. Só entram filiais que a pessoa pode ver.
 */
export function escolherAlcance(alcances: Alcance[], escolas: Escola[], params: { filiais?: string; alcance?: string }, propria: string): Alcance {
  const todasAs = alcances.find((a) => a.chave === "todas");
  if (params.filiais) {
    const ids = new Set(params.filiais.split(","));
    const sel = escolas.filter((e) => ids.has(e.id));
    if (sel.length === escolas.length && todasAs) return todasAs;
    const igual = alcances.find((a) => a.escolas.length === sel.length && a.escolas.every((e) => ids.has(e.id)));
    if (igual) return igual;
    if (sel.length) return { chave: sel.map((e) => e.id).join(","), rotulo: `${sel.length} filiais: ${sel.map((e) => e.nome).join(", ")}`, escolas: sel };
  }
  return alcances.find((a) => a.chave === params.alcance) ?? alcances.find((a) => a.chave === propria) ?? alcances[0];
}

// ---------- soma dos resumos do Mercúrio ----------
function somarResumos(lista: ResumoFilialDados[]) {
  const porNivel = new Map<string, { nivel: string; rotulo: string; total: number }>();
  const meses = new Map<string, { mes: string; entradas: number; saidas: number; segundoNivel: number; recuperados: number }>();
  const motivos = new Map<string, number>();
  const receita = new Map<string, { mes: string; valor: number; recibos: number }>();
  const soma = {
    atualizacaoMercurio: null as string | null,
    pessoas: { ativos: 0, membros: 0, fv: 0, provacionistas: 0, hd: 0, dirigentes: 0, recuperados: 0 },
    contribuicao: { paga: 0, emBranco: 0, atrasada: 0, isenta: 0, pessoasComAtraso: 0, mesesEmAtraso: 0 },
    turmas: { total: 0, semInstrutor: 0, alunos: 0 },
    aniversariantes: 0,
  };
  for (const d of lista) {
    if (d.atualizacaoMercurio && (!soma.atualizacaoMercurio || d.atualizacaoMercurio < soma.atualizacaoMercurio)) soma.atualizacaoMercurio = d.atualizacaoMercurio;
    for (const k of ["ativos", "membros", "fv", "provacionistas", "hd", "dirigentes", "recuperados"] as const) soma.pessoas[k] += d.pessoas[k] ?? 0;
    for (const p of d.pessoas.porNivel) {
      const x = porNivel.get(p.nivel) ?? { ...p, total: 0 };
      x.total += p.total;
      porNivel.set(p.nivel, x);
    }
    for (const mm of d.movimento.meses) {
      const x = meses.get(mm.mes) ?? { mes: mm.mes, entradas: 0, saidas: 0, segundoNivel: 0, recuperados: 0 };
      x.entradas += mm.entradas;
      x.saidas += mm.saidas;
      x.segundoNivel += mm.segundoNivel;
      x.recuperados += mm.recuperados ?? 0;
      meses.set(mm.mes, x);
    }
    for (const mo of d.movimento.motivosSaida) motivos.set(mo.motivo, (motivos.get(mo.motivo) ?? 0) + mo.total);
    const c = d.contribuicao.mesAtual;
    soma.contribuicao.paga += c.paga;
    soma.contribuicao.emBranco += c.emBranco;
    soma.contribuicao.atrasada += c.atrasada;
    soma.contribuicao.isenta += c.isenta;
    soma.contribuicao.pessoasComAtraso += d.contribuicao.pessoasComAtraso;
    soma.contribuicao.mesesEmAtraso += d.contribuicao.mesesEmAtraso;
    for (const r of d.receita) {
      const x = receita.get(r.mes) ?? { mes: r.mes, valor: 0, recibos: 0 };
      x.valor += r.valor;
      x.recibos += r.recibos;
      receita.set(r.mes, x);
    }
    soma.turmas.total += d.turmas.total;
    soma.turmas.semInstrutor += d.turmas.lista.filter((t) => t.instrutores === 0).length;
    soma.turmas.alunos += d.turmas.lista.reduce((s, t) => s + t.alunos, 0);
    soma.aniversariantes += d.aniversariantes.length;
  }
  return {
    ...soma,
    porNivel: [...porNivel.values()].sort((a, b) => b.total - a.total),
    meses: [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
    motivosSaida: [...motivos].map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total).slice(0, 6),
    receita: [...receita.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
  };
}

const contarPorEscola = (linhas: { schoolId: string; n: number | bigint }[]) => new Map(linhas.map((l) => [l.schoolId, Number(l.n)]));

/**
 * Profissões e áreas de atuação (antes só no Painel Nacional): o resumo nacional do Mercúrio, inteiro em
 * "Todas as filiais" (todas as unidades da OINAB-N) ou recortado nas unidades das filiais escolhidas.
 */
async function profissoes(escolas: Escola[], todas: boolean): Promise<ResumoProfissoes | null> {
  const r = await db.resumoNacional.findUnique({ where: { chave: "profissoes" } });
  if (!r) return null;
  const dados = r.dados as unknown as ResumoProfissoes;
  if (todas) return dados;
  const unis = new Set(escolas.map((e) => e.unidade).filter(Boolean) as string[]);
  return { ...dados, unidades: dados.unidades.filter((u) => unis.has(u.id)), porUnidade: Object.fromEntries(Object.entries(dados.porUnidade).filter(([u]) => unis.has(u))) };
}

/** Detalhes que só fazem sentido para uma filial: aniversariantes, lista de turmas e a rodada de avaliação dos instrutores. */
async function detalhesDaFilial(schoolId: string, d: ResumoFilialDados | undefined) {
  const campanha = await db.avaliacaoCampanha.findFirst({ where: { schoolId }, orderBy: { abertaEm: "desc" } });
  let avaliacao: { titulo: string; aberta: boolean; participantes: number; mediaInstrutores: number | null; nps: number | null } | null = null;
  if (campanha) {
    const rel = await relatorioCampanha(campanha.id, {});
    const notas = rel.porInstrutor.filter((i) => i.media !== null);
    avaliacao = {
      titulo: campanha.titulo,
      aberta: campanha.status === "aberta",
      participantes: (await db.avaliacaoParticipacao.groupBy({ by: ["memberId"], where: { campanhaId: campanha.id } })).length,
      mediaInstrutores: notas.length ? notas.reduce((s, i) => s + i.media!, 0) / notas.length : null,
      nps: rel.geral.perguntas.map((q) => (q.resumo.tipo === "escala" ? q.resumo.nps : null)).find((x) => x !== null) ?? null,
    };
  }
  return { aniversariantes: d?.aniversariantes ?? [], turmas: d?.turmas.lista ?? [], avaliacao };
}

/** Todos os números do panorama para as filiais escolhidas, no total e por filial. `todas`: alcance nacional. */
export async function carregarPanorama(escolas: Escola[], todas = false) {
  const ids = escolas.map((e) => e.id);
  const agora = new Date();
  const em30 = new Date(agora.getTime() + 30 * 864e5);
  const ha30 = new Date(agora.getTime() - 30 * 864e5);
  const ativosNa = { schoolId: { in: ids }, mercurioAtivo: true };

  const virtuais = escolas.filter((e) => e.foraDoPortal && e.unidade);
  const [resumos, resumosFora, contas, entraram, notificacoes, pedidosCadastro, pendencias, falhas, proximos, passados, aberturas, crms, acessos, grupos] = await Promise.all([
    db.resumoFilial.findMany({ where: { schoolId: { in: ids } }, select: { schoolId: true, dados: true, geradoEm: true } }),
    virtuais.length
      ? db.resumoNacional.findMany({ where: { chave: { in: virtuais.map((e) => `unidade:${e.unidade}`) } }, select: { chave: true, dados: true, geradoEm: true } })
      : Promise.resolve([]),
    db.member.groupBy({ by: ["schoolId"], where: { ...ativosNa, authUserId: { not: null } }, _count: { _all: true } }),
    db.$queryRaw<{ schoolId: string; n: bigint }[]>`SELECT m."schoolId", count(*) n FROM auth.users u JOIN "Member" m ON m."authUserId" = u.id::text WHERE u.last_sign_in_at IS NOT NULL AND m."mercurioAtivo" AND m."schoolId" IN (${Prisma.join(ids)}) GROUP BY 1`,
    db.$queryRaw<{ schoolId: string; n: bigint }[]>`SELECT m."schoolId", count(DISTINCT p."memberId") n FROM "PushSubscription" p JOIN "Member" m ON m.id = p."memberId" WHERE m."schoolId" IN (${Prisma.join(ids)}) GROUP BY 1`,
    db.contactChangeLog.count({ where: { status: "pendente", member: { schoolId: { in: ids } } } }),
    db.scholasticPendency.count({ where: { schoolId: { in: ids }, completedAt: null } }),
    db.mercurioSyncTask.count({ where: { status: "falhou", member: { schoolId: { in: ids } } } }),
    db.event.findMany({
      where: { schoolId: { in: ids }, status: "publicado", startsAt: { gte: agora, lte: em30 } },
      select: { id: true, title: true, startsAt: true, schoolId: true, source: true, capacity: true, _count: { select: { registrations: { where: { desistenciaEm: null } } } } },
      orderBy: { startsAt: "asc" },
    }),
    db.event.findMany({
      where: { schoolId: { in: ids }, source: "manual", status: "publicado", startsAt: { gte: ha30, lt: agora } },
      select: { schoolId: true, _count: { select: { registrations: { where: { desistenciaEm: null } } } }, registrations: { where: { checkedIn: true }, select: { id: true } } },
    }),
    db.aberturaTurma.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, status: { in: ["planejada", "em_curso"] } }, _count: { _all: true } }),
    db.aberturaCrmCache.findMany({ where: { schoolId: { in: ids } }, select: { schoolId: true, dados: true } }),
    db.acessoVoluntario.findMany({ select: { memberId: true } }).then(async (a) =>
      db.member.groupBy({ by: ["schoolId"], where: { ...ativosNa, id: { in: a.map((x) => x.memberId) } }, _count: { _all: true } }),
    ),
    db.classGroup.groupBy({ by: ["schoolId", "tipo"], where: { schoolId: { in: ids }, arquivadoEm: null, tipo: { not: "turma" } }, _count: { _all: true } }),
  ]);

  const resumoDe = new Map(resumos.map((r) => [r.schoolId, r.dados as unknown as ResumoFilialDados]));
  for (const r of resumosFora) resumoDe.set(`uni:${r.chave.slice("unidade:".length)}`, r.dados as unknown as ResumoFilialDados);
  // Data do resumo mais antigo do alcance: o que a tela mostra como "Atualizado em".
  const geracoes = [...resumos, ...resumosFora].map((r) => r.geradoEm.getTime());
  const contasDe = new Map(contas.map((c) => [c.schoolId, c._count._all]));
  const entraramDe = contarPorEscola(entraram);
  const notificacoesDe = contarPorEscola(notificacoes);
  const aberturasDe = new Map(aberturas.map((a) => [a.schoolId, a._count._all]));
  const acessosDe = new Map(acessos.map((a) => [a.schoolId, a._count._all]));
  const crmDe = new Map(
    crms.map((c) => {
      const d = (c.dados ?? {}) as { leads?: unknown[]; matriculas?: unknown[] };
      return [c.schoolId, { interessados: d.leads?.length ?? 0, matriculas: d.matriculas?.length ?? 0 }];
    }),
  );
  const gruposDe = (schoolId: string | null, tipos: string[]) =>
    grupos.filter((g) => (schoolId === null || g.schoolId === schoolId) && tipos.includes(g.tipo)).reduce((s, g) => s + g._count._all, 0);
  const somaMapa = (m: Map<string, number>) => ids.reduce((s, id) => s + (m.get(id) ?? 0), 0);
  const nomes = new Map(escolas.map((e) => [e.id, e.nome]));
  const mesAtual = (d?: ResumoFilialDados) => d?.movimento.meses.at(-1);

  const total = somarResumos([...resumoDe.values()]);
  const [profissoesDados, detalhes] = await Promise.all([
    profissoes(escolas, todas),
    escolas.length === 1 ? detalhesDaFilial(escolas[0].id, resumoDe.get(escolas[0].id)) : Promise.resolve(null),
  ]);
  const presencaPassados = passados.reduce((s, e) => s + e.registrations.length, 0);
  const inscritosPassados = passados.reduce((s, e) => s + e._count.registrations, 0);

  return {
    agora: agora.getTime(),
    temResumo: resumoDe.size > 0,
    atualizadoEm: geracoes.length ? Math.min(...geracoes) : null,
    atualizadoAte: geracoes.length ? Math.max(...geracoes) : null,
    foraDoPortal: virtuais.length,
    profissoes: profissoesDados,
    detalhes,
    faltamResumos: escolas.filter((e) => !resumoDe.has(e.id)).map((e) => e.nome),
    mercurio: total,
    portal: {
      contas: somaMapa(contasDe),
      entraram: somaMapa(entraramDe),
      notificacoes: somaMapa(notificacoesDe),
      pedidosCadastro,
      pendencias,
      falhas,
    },
    eventos: {
      proximos: proximos.length,
      inscritosProximos: proximos.filter((e) => e.source === "manual").reduce((s, e) => s + e._count.registrations, 0),
      lista: proximos.slice(0, 6).map((e) => ({ id: e.id, titulo: e.title, inicio: e.startsAt.toISOString(), filial: nomes.get(e.schoolId ?? "") ?? "", inscritos: e.source === "manual" ? e._count.registrations : null, vagas: e.capacity })),
      passados: passados.length,
      presencaPassados,
      inscritosPassados,
    },
    aberturas: {
      ativas: somaMapa(aberturasDe),
      interessados: ids.reduce((s, id) => s + (crmDe.get(id)?.interessados ?? 0), 0),
      matriculas: ids.reduce((s, id) => s + (crmDe.get(id)?.matriculas ?? 0), 0),
    },
    voluntariado: {
      acessos: somaMapa(acessosDe),
      secretarias: gruposDe(null, ["SEC"]),
      gaf: gruposDe(null, ["GAF"]),
      estudos: gruposDe(null, ["ESTUDO", "LEITURA"]),
      fv: gruposDe(null, ["BF", "BM", "CS"]),
      gdve: gruposDe(null, ["GDVE"]),
    },
    // Linha por filial (tabela quando o alcance tem mais de uma).
    porFilial: escolas.map((e) => {
      const d = resumoDe.get(e.id);
      const c = d?.contribuicao.mesAtual;
      const fichas = c ? c.paga + c.emBranco + c.atrasada + c.isenta : 0;
      return {
        id: e.id,
        nome: e.nome,
        foraDoPortal: !!e.foraDoPortal,
        ativos: d?.pessoas.ativos ?? null,
        entradas: mesAtual(d)?.entradas ?? null,
        saidas: mesAtual(d)?.saidas ?? null,
        pagaPct: c && fichas ? Math.round((c.paga / fichas) * 100) : null,
        eventos: proximos.filter((x) => x.schoolId === e.id).length,
        aberturas: aberturasDe.get(e.id) ?? 0,
        voluntarios: acessosDe.get(e.id) ?? 0,
        entraram: entraramDe.get(e.id) ?? 0,
        grupos: gruposDe(e.id, ["GAF", "ESTUDO", "LEITURA", "SEC"]),
      };
    }),
  };
}

export type Panorama = Awaited<ReturnType<typeof carregarPanorama>>;
