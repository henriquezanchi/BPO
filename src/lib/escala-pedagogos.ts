import "server-only";
import { fusoDaEscola } from "@/lib/atendimentos";
import { db } from "@/lib/db";
import { localInZone } from "@/lib/group-meetings";
import { chaveTema, programaDaDisciplina, programaDaSigla, proximoTema, STATUS_NA_TRILHA, temasFeitos, type Programa } from "@/lib/pedagogos-programa";
import { TEMAS_POR_MATERIA } from "@/lib/temas-curriculo";

/**
 * Escala de apresentações da turma de pedagogos (pedido do usuário 2026-10-26): os encontros são semanais, com
 * duração variável; cada pedagogo apresenta sua aula (15 min) ao instrutor dos pedagogos. A escala diz quem
 * apresenta, em que dia e qual tema. Cada pedagogo segue a própria trilha do programa (N1: todos os temas de Ética,
 * Sociedade e Filosofia da História — lib/pedagogos-programa.ts, pedido do usuário 2026-10-29): apresenta o próximo
 * tema que ainda não apresentou, sem ligação com os colegas. O plano de aula é entregue até 7 dias antes.
 */

export const DIAS_ANTES_PLANO = 7;
export const MINUTOS_APRESENTACAO = 15;
export const BUCKET_PLANOS = "planos-aula";
export const TAMANHO_MAX_PLANO = 20 * 1024 * 1024;
export const EXTENSOES_PLANO = ["pdf", "doc", "docx", "odt", "ppt", "pptx", "odp", "txt", "rtf"];

/** Disciplinas com catálogo de temas (as demais entram quando o usuário mandar as listas). */
export function disciplinasDisponiveis() {
  return Object.entries(TEMAS_POR_MATERIA).map(([sigla, c]) => ({ sigla, nome: c.bloco ? `${c.curso} · ${c.bloco}` : c.curso, temas: c.temas.length }));
}

const somaDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 864e5).toISOString().slice(0, 10);
/**
 * Prazo do plano: 7 dias antes da apresentação. Se a apresentação foi marcada depois disso (escala feita em cima da
 * hora), o prazo passa a ser a véspera — ou o próprio dia da marcação, se foi marcada na véspera ou no dia.
 */
export function prazoDoPlano(data: string, marcadaEm?: Date, fuso = "America/Sao_Paulo") {
  const padrao = somaDias(data, -DIAS_ANTES_PLANO);
  const marcada = marcadaEm ? localInZone(marcadaEm, fuso).slice(0, 10) : null;
  if (!marcada || marcada <= padrao) return padrao;
  const vespera = somaDias(data, -1);
  return marcada > vespera ? marcada : vespera;
}

/** Temas apresentados antes do controle no Portal: registro com esta data, que não aparece na escala nem em "Já aconteceram". */
export const DATA_ANTES_DO_PORTAL = "2000-01-01";
export const hojeNoFuso = (fuso: string) => localInZone(new Date(), fuso).slice(0, 10);

export type SituacaoPlano = "aprovado" | "entregue" | "devolvido" | "atrasado" | "no_prazo";

/** Situação do plano de uma apresentação na data de hoje (fuso da filial). */
export function situacaoDoPlano(data: string, plano: { status: string } | null, hoje: string, prazo = prazoDoPlano(data)): SituacaoPlano {
  if (plano?.status === "aprovado") return "aprovado";
  if (plano?.status === "entregue") return "entregue";
  if (plano?.status === "devolvido") return "devolvido";
  return hoje > prazo ? "atrasado" : "no_prazo";
}

/** Temas da trilha de cada pessoa (todas as turmas): marcados ou feitos contam; "faltou" e "cancelada" voltam para a fila. */
export async function trilhasDosPedagogos(ids: string[], somenteApresentadas = false) {
  const linhas = await db.apresentacaoPedagogo.findMany({
    where: { pedagogoId: { in: ids }, status: somenteApresentadas ? "apresentada" : { in: STATUS_NA_TRILHA } },
    select: { pedagogoId: true, materiaSigla: true, tema: true },
  });
  const por = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const l of linhas) por.get(l.pedagogoId)?.push(chaveTema(l.materiaSigla, l.tema));
  return por;
}

/** Progresso de cada pessoa no programa: temas já apresentados e o próximo da trilha. */
export async function progressoNoPrograma(programa: Programa, pessoas: { id: string; name: string }[]) {
  const ids = pessoas.map((p) => p.id);
  const [apresentadas, naTrilha, anteriores] = await Promise.all([
    trilhasDosPedagogos(ids, true),
    trilhasDosPedagogos(ids),
    db.apresentacaoPedagogo.findMany({ where: { pedagogoId: { in: ids }, data: DATA_ANTES_DO_PORTAL }, select: { pedagogoId: true, materiaSigla: true, tema: true } }),
  ]);
  const doPrograma = new Set(programa.temas.map((t) => chaveTema(t.sigla, t.titulo)));
  return pessoas.map((p) => {
    const antes = anteriores.filter((a) => a.pedagogoId === p.id).map((a) => chaveTema(a.materiaSigla, a.tema));
    return {
      id: p.id,
      nome: p.name,
      apresentados: temasFeitos(programa, apresentadas.get(p.id) ?? []),
      marcados: temasFeitos(programa, naTrilha.get(p.id) ?? []),
      proximo: proximoTema(programa, naTrilha.get(p.id) ?? []),
      // Para o registro do que a pessoa apresentou antes do Portal: o que já está lá e o que veio pela escala.
      anteriores: antes.filter((k) => doPrograma.has(k)),
      pelaEscala: (naTrilha.get(p.id) ?? []).filter((k) => doPrograma.has(k) && !antes.includes(k)),
    };
  });
}

/**
 * Datas dos encontros a partir de `inicio`: as dos encontros já marcados no grupo (aba Encontros) e, se faltar,
 * semanais no dia da semana dado (ou no dia de `inicio`).
 */
export async function datasDosEncontros(grupoId: string, fuso: string, inicio: string, quantas: number, diaSemana?: number) {
  const encontros = await db.groupMeeting.findMany({
    where: { classGroupId: grupoId, status: "agendada", startsAt: { gte: new Date(Date.parse(`${inicio}T00:00:00Z`) - 864e5) } },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true, timeZone: true },
    take: quantas * 2,
  });
  const datas = [...new Set(encontros.map((e) => localInZone(e.startsAt, e.timeZone || fuso).slice(0, 10)).filter((d) => d >= inicio))];
  const dia = diaSemana ?? new Date(`${inicio}T12:00:00Z`).getUTCDay();
  let d = datas.at(-1) ? somaDias(datas.at(-1)!, 7) : inicio;
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== dia) d = somaDias(d, 1);
  while (datas.length < quantas) {
    datas.push(d);
    d = somaDias(d, 7);
  }
  return datas.slice(0, quantas);
}

/** Pedagogos da turma, primeiro quem apresentou há mais tempo (ou nunca), para o rodízio ser justo. */
export async function pedagogosEmRodizio(grupoId: string) {
  const integrantes = await db.classMembership.findMany({
    where: { classGroupId: grupoId, role: "aluno", member: { mercurioAtivo: true } },
    select: { member: { select: { id: true, name: true } } },
  });
  const ultimas = await db.apresentacaoPedagogo.groupBy({
    by: ["pedagogoId"],
    where: { classGroupId: grupoId, status: { not: "cancelada" } },
    _max: { data: true },
  });
  const ultimaDe = new Map(ultimas.map((u) => [u.pedagogoId, u._max.data ?? ""]));
  return integrantes
    .map((i) => i.member)
    .sort((a, b) => (ultimaDe.get(a.id) ?? "").localeCompare(ultimaDe.get(b.id) ?? "") || a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Monta (sem gravar) a próxima rodada: cada pedagogo que ainda não concluiu o programa apresenta uma vez, o próximo
 * tema da própria trilha; `porEncontro` por data. Quem já tem todos os temas marcados ou feitos fica de fora.
 */
export async function previaDaEscala(grupoId: string, opcoes: { programa: string; inicio: string; porEncontro: number; diaSemana?: number }) {
  const programa = programaDaSigla(opcoes.programa);
  const grupo = await db.classGroup.findUniqueOrThrow({ where: { id: grupoId }, select: { school: { select: { uf: true } } } });
  const fuso = fusoDaEscola(grupo.school.uf);
  const todos = await pedagogosEmRodizio(grupoId);
  if (!programa || !todos.length) return { fuso, linhas: [], concluiram: [], trilhas: {} };
  const trilhas = await trilhasDosPedagogos(todos.map((p) => p.id));
  const comTema = todos.map((p) => ({ ...p, tema: proximoTema(programa, trilhas.get(p.id) ?? []) }));
  const pedagogos = comTema.filter((p) => p.tema);
  const porEncontro = Math.max(1, Math.min(6, Math.floor(opcoes.porEncontro)));
  const datas = pedagogos.length ? await datasDosEncontros(grupoId, fuso, opcoes.inicio, Math.ceil(pedagogos.length / porEncontro), opcoes.diaSemana) : [];
  return {
    fuso,
    linhas: pedagogos.map((p, i) => ({
      pedagogoId: p.id,
      pedagogo: p.name,
      data: datas[Math.floor(i / porEncontro)],
      ordem: (i % porEncontro) + 1,
      materiaSigla: p.tema!.sigla,
      tema: p.tema!.titulo,
      topicos: p.tema!.topicos,
    })),
    concluiram: comTema.filter((p) => !p.tema).map((p) => p.name),
    // Trilha de todos da turma, para a tela marcar os temas já feitos e sugerir o próximo ao trocar a pessoa.
    trilhas: Object.fromEntries(trilhas),
  };
}

/**
 * Para o Portal do Aluno (pedido do usuário 2026-10-29): a turma de pedagogos da pessoa e a próxima apresentação dela,
 * com o prazo e a situação do plano. Quem entra na turma antes de ser instrutor no Mercúrio só chega à escala por aqui.
 */
export async function minhaTurmaDePedagogos(memberId: string, fuso: string) {
  const turma = await db.classMembership.findFirst({
    where: { memberId, role: "aluno", classGroup: { tipo: "PED", arquivadoEm: null } },
    select: { classGroup: { select: { id: true, name: true } } },
  });
  if (!turma) return null;
  const hoje = hojeNoFuso(fuso);
  const a = await db.apresentacaoPedagogo.findFirst({
    where: { pedagogoId: memberId, status: "agendada", data: { gte: hoje } },
    orderBy: [{ data: "asc" }, { ordem: "asc" }],
    select: { classGroupId: true, data: true, materiaSigla: true, tema: true, createdAt: true, plano: { select: { status: true } } },
  });
  const proxima = a && (() => {
    const programa = programaDaDisciplina(a.materiaSigla);
    const disciplina = programa && programa.disciplinas > 1 ? programa.temas.find((t) => t.sigla === a.materiaSigla)?.disciplina : null;
    const prazo = prazoDoPlano(a.data, a.createdAt, fuso);
    return { grupoId: a.classGroupId, data: a.data, tema: disciplina ? `${disciplina} · ${a.tema}` : a.tema, prazo, situacao: situacaoDoPlano(a.data, a.plano, hoje, prazo) };
  })();
  return { grupoId: proxima?.grupoId ?? turma.classGroup.id, nome: turma.classGroup.name, proxima };
}
