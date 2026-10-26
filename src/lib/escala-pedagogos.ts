import "server-only";
import { fusoDaEscola } from "@/lib/atendimentos";
import { db } from "@/lib/db";
import { localInZone } from "@/lib/group-meetings";
import { catalogoDaMateria, TEMAS_POR_MATERIA } from "@/lib/temas-curriculo";

/**
 * Escala de apresentações da turma de pedagogos (pedido do usuário 2026-10-26): os encontros são semanais, com
 * duração variável; cada pedagogo apresenta sua aula (15 min) ao instrutor dos pedagogos. A escala diz quem
 * apresenta, em que dia e qual tema. O tema é a sequência dos temas da disciplina escolhida (catálogo em
 * lib/temas-curriculo.ts), continuando de onde a última apresentação daquela disciplina parou. O plano de aula
 * é entregue até 7 dias antes da apresentação.
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
export const prazoDoPlano = (data: string) => somaDias(data, -DIAS_ANTES_PLANO);
export const hojeNoFuso = (fuso: string) => localInZone(new Date(), fuso).slice(0, 10);

export type SituacaoPlano = "aprovado" | "entregue" | "devolvido" | "atrasado" | "no_prazo";

/** Situação do plano de uma apresentação na data de hoje (fuso da filial). */
export function situacaoDoPlano(data: string, plano: { status: string } | null, hoje: string): SituacaoPlano {
  if (plano?.status === "aprovado") return "aprovado";
  if (plano?.status === "entregue") return "entregue";
  if (plano?.status === "devolvido") return "devolvido";
  return hoje > prazoDoPlano(data) ? "atrasado" : "no_prazo";
}

/** Próximos `n` temas da disciplina na turma, continuando depois do último já escalado (volta ao início no fim). */
export async function proximosTemas(grupoId: string, sigla: string, n: number) {
  const catalogo = catalogoDaMateria(sigla);
  if (!catalogo?.temas.length) return [];
  const ultima = await db.apresentacaoPedagogo.findFirst({
    where: { classGroupId: grupoId, materiaSigla: sigla, status: { not: "cancelada" } },
    orderBy: [{ data: "desc" }, { ordem: "desc" }],
    select: { tema: true },
  });
  const i = ultima ? catalogo.temas.findIndex((t) => t.titulo === ultima.tema) : -1;
  return Array.from({ length: n }, (_, k) => catalogo.temas[(i + 1 + k) % catalogo.temas.length]);
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

/** Monta (sem gravar) a próxima rodada: todos os pedagogos uma vez, `porEncontro` por data, temas em sequência. */
export async function previaDaEscala(grupoId: string, opcoes: { sigla: string; inicio: string; porEncontro: number; diaSemana?: number }) {
  const grupo = await db.classGroup.findUniqueOrThrow({ where: { id: grupoId }, select: { school: { select: { uf: true } } } });
  const fuso = fusoDaEscola(grupo.school.uf);
  const pedagogos = await pedagogosEmRodizio(grupoId);
  if (!pedagogos.length) return { fuso, linhas: [] };
  const porEncontro = Math.max(1, Math.min(6, Math.floor(opcoes.porEncontro)));
  const datas = await datasDosEncontros(grupoId, fuso, opcoes.inicio, Math.ceil(pedagogos.length / porEncontro), opcoes.diaSemana);
  const temas = await proximosTemas(grupoId, opcoes.sigla, pedagogos.length);
  return {
    fuso,
    linhas: pedagogos.map((p, i) => ({
      pedagogoId: p.id,
      pedagogo: p.name,
      data: datas[Math.floor(i / porEncontro)],
      ordem: (i % porEncontro) + 1,
      materiaSigla: opcoes.sigla,
      tema: temas[i]?.titulo ?? "Tema a definir",
      topicos: temas[i]?.topicos ?? [],
    })),
  };
}
