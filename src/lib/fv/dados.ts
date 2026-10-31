import "server-only";
import { db } from "@/lib/db";
import { datasPermitidas, PRATICA_TRATAK, somarDias } from "@/lib/diario";
import { hojeDaPessoa } from "@/lib/diario-dados";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { minutosDeAula, type Calendario, type DiaDoCiclo, type ItensDegrau, type Presencas, type TarefaGdve } from "@/lib/fv/comum";
import type { DiaDaCarta } from "@/lib/fv/historico-carta";
import { meusGrupos } from "@/lib/grupos-dados";
import type { DiarioFvDia, DiarioFvFicha } from "@prisma/client";

/**
 * Leitura do diário de FV (pedido do usuário 2026-10-31). Sempre do próprio diário de quem está logado: nem a
 * coordenação do GDVE, nem a direção, nem a administração leem o diário de outra pessoa.
 */
type Pessoa = Parameters<typeof meusGrupos>[0] & { name: string; school: { uf: string | null } | null };

/** O diário de FV é de quem participa de um GDVE (no Portal, GDVE só é visto por FV com acesso de voluntário). */
export async function participaDeGdve(m: Parameters<typeof meusGrupos>[0]) {
  return (await meusGrupos(m, ["GDVE"])).map((g) => g.id);
}

const comoFicha = (f: DiarioFvFicha | null) => ({
  unidade: f?.unidade ?? null,
  condicao: f?.condicao ?? null,
  mestre: f?.mestre ?? null,
  ultimoEncontro: f?.ultimoEncontro ?? null,
  ultimaCarta: f?.ultimaCarta ?? null,
  proximaCarta: f?.proximaCarta ?? null,
  calendario: (f?.calendario ?? {}) as Calendario,
  tarefas: (f?.tarefas ?? []) as TarefaGdve[],
  ciclo: (f?.ciclo ?? {}) as Record<string, boolean>,
  proximaReuniao: f?.proximaReuniao ?? null,
});
export type FichaFv = ReturnType<typeof comoFicha>;

const praticasFeitas = (j: unknown) => Object.entries((j ?? {}) as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k);

/** Um dia do ciclo para as contas (FV + o diário comum: Prólogo, Tratak e práticas pessoais). */
function diaDoCiclo(data: string, fv: DiarioFvDia | undefined, comum: { prologoEm: Date | null; praticas: unknown } | undefined, nomePratica: Map<string, string>, cal: Calendario): DiaDoCiclo {
  const presencas = (fv?.presencas ?? {}) as Presencas;
  const aula = minutosDeAula(cal, data, presencas);
  const comuns = praticasFeitas(comum?.praticas);
  return {
    data,
    prologo: !!comum?.prologoEm,
    praticas: [...praticasFeitas(fv?.praticas), ...(comuns.includes(PRATICA_TRATAK) ? [PRATICA_TRATAK] : [])],
    praticasPessoais: comuns.flatMap((id) => (nomePratica.has(id) ? [nomePratica.get(id)!] : [])),
    presencas,
    minutosVoluntariado: fv?.minutosVoluntariado ?? 0,
    minutosAulaAssistida: fv?.minutosAulaAssistida ?? aula.assistida,
    minutosAulaMinistrada: fv?.minutosAulaMinistrada ?? aula.ministrada,
  };
}

export async function carregarDiarioFv(m: Pessoa, dataPedida?: string) {
  const fuso = fusoDaEscola(m.school?.uf);
  const hoje = hojeDaPessoa(m);
  const permitidas = datasPermitidas(hoje);
  const data = dataPedida && permitidas.includes(dataPedida) ? dataPedida : hoje;
  const desde = somarDias(hoje, -30);
  const grupos = await participaDeGdve(m);
  const [fichaBruta, diasFv, diasComuns, praticasPessoais, livro, reuniao] = await Promise.all([
    db.diarioFvFicha.findUnique({ where: { memberId: m.id } }),
    db.diarioFvDia.findMany({ where: { memberId: m.id, data: { gte: desde } } }),
    db.diarioDia.findMany({ where: { memberId: m.id, data: { gte: desde } }, select: { data: true, prologoEm: true, praticas: true } }),
    db.diarioPratica.findMany({ where: { memberId: m.id }, select: { id: true, nome: true } }),
    db.livroLeitura.findFirst({ where: { memberId: m.id, situacao: "lendo" }, orderBy: { updatedAt: "desc" }, select: { titulo: true, autor: true } }),
    // Próxima reunião: o encontro marcado no Portal para o GDVE da pessoa (antes era uma data digitada no diário).
    grupos.length ? db.groupMeeting.findFirst({ where: { classGroupId: { in: grupos }, status: "agendada", endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, select: { startsAt: true } }) : null,
  ]);
  const ficha = comoFicha(fichaBruta);
  const porData = new Map(diasFv.map((d) => [d.data, d]));
  const comumPorData = new Map(diasComuns.map((d) => [d.data, d]));
  const nomePratica = new Map(praticasPessoais.map((p) => [p.id, p.nome]));
  const ciclo = Array.from({ length: 31 }, (_, i) => somarDias(hoje, -i)).map((d) => diaDoCiclo(d, porData.get(d), comumPorData.get(d), nomePratica, ficha.calendario));
  const dia = porData.get(data);
  const tratakNoDia = praticasFeitas(comumPorData.get(data)?.praticas).includes(PRATICA_TRATAK);
  return {
    hoje,
    data,
    datas: permitidas,
    fuso,
    primeiroNome: m.name.split(" ")[0],
    ficha,
    dia: {
      itens: (dia?.itens ?? {}) as ItensDegrau,
      praticas: { ...Object.fromEntries(praticasFeitas(dia?.praticas).map((k) => [k, true])), ...(tratakNoDia ? { [PRATICA_TRATAK]: true } : {}) } as Record<string, boolean>,
      presencas: (dia?.presencas ?? {}) as Presencas,
      minutosVoluntariado: dia?.minutosVoluntariado ?? null,
      gdveTarefas: (dia?.gdveTarefas ?? {}) as Record<string, number>,
      gdvePresenca: dia?.gdvePresenca ?? false,
    },
    proximaReuniao: reuniao?.startsAt.toISOString() ?? (ficha.proximaReuniao ? ficha.proximaReuniao : null),
    reuniaoDoPortal: !!reuniao,
    ciclo,
    livroAtual: livro ? `${livro.titulo}${livro.autor ? ` (${livro.autor})` : ""}` : null,
  };
}
export type DiarioFvDaPessoa = Awaited<ReturnType<typeof carregarDiarioFv>>;

/** Histórico de FV de um mês (só leitura), do mais recente ao mais antigo. */
export async function carregarHistoricoFv(m: Pessoa, mesPedido?: string) {
  const hoje = hojeDaPessoa(m);
  const todas = await db.diarioFvDia.findMany({ where: { memberId: m.id }, select: { data: true }, orderBy: { data: "desc" } });
  const meses = [...new Set(todas.map((d) => d.data.slice(0, 7)))];
  const mes = mesPedido && meses.includes(mesPedido) ? mesPedido : (meses[0] ?? hoje.slice(0, 7));
  const [dias, comuns] = await Promise.all([
    db.diarioFvDia.findMany({ where: { memberId: m.id, data: { startsWith: mes } }, orderBy: { data: "desc" } }),
    db.diarioDia.findMany({ where: { memberId: m.id, data: { startsWith: mes } }, select: { data: true, praticas: true } }),
  ]);
  const tratak = new Set(comuns.filter((c) => praticasFeitas(c.praticas).includes(PRATICA_TRATAK)).map((c) => c.data));
  return {
    mes,
    meses,
    dias: dias.map((d) => ({
      data: d.data,
      itens: d.itens as ItensDegrau,
      praticas: [...(tratak.has(d.data) ? [PRATICA_TRATAK] : []), ...praticasFeitas(d.praticas)],
      presencas: d.presencas as Presencas,
      minutosVoluntariado: d.minutosVoluntariado,
      gdvePresenca: d.gdvePresenca,
    })),
  };
}
export type HistoricoFv = Awaited<ReturnType<typeof carregarHistoricoFv>>;

/** Dias para o "Histórico da Carta de Degrau" (desde a última Carta; sem ela, os últimos 30 dias). */
export async function diasDaCarta(m: Pessoa) {
  const hoje = hojeDaPessoa(m);
  const ficha = comoFicha(await db.diarioFvFicha.findUnique({ where: { memberId: m.id } }));
  const desde = ficha.ultimaCarta && ficha.ultimaCarta < hoje ? ficha.ultimaCarta : somarDias(hoje, -30);
  const [dias, comuns] = await Promise.all([
    db.diarioFvDia.findMany({ where: { memberId: m.id, data: { gt: desde, lte: hoje } } }),
    db.diarioDia.findMany({ where: { memberId: m.id, data: { gt: desde, lte: hoje } }, select: { data: true, praticas: true } }),
  ]);
  const tratak = new Set(comuns.filter((c) => praticasFeitas(c.praticas).includes(PRATICA_TRATAK)).map((c) => c.data));
  const lista: DiaDaCarta[] = dias.map((d) => {
    const aula = minutosDeAula(ficha.calendario, d.data, d.presencas as Presencas);
    return {
      data: d.data,
      itens: d.itens as ItensDegrau,
      temPratica: praticasFeitas(d.praticas).length > 0 || tratak.has(d.data),
      minutosVoluntariado: d.minutosVoluntariado ?? 0,
      minutosAulaAssistida: d.minutosAulaAssistida ?? aula.assistida,
      minutosAulaMinistrada: d.minutosAulaMinistrada ?? aula.ministrada,
    };
  });
  return { dias: lista, ultimaCarta: ficha.ultimaCarta, mestre: ficha.mestre, hoje };
}
