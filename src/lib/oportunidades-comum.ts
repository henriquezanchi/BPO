import { SECRETARIAS_PADRAO } from "@/lib/secretarias";

/** Partes das oportunidades de voluntariado usadas também no navegador (ver lib/oportunidades.ts). */
export const AREAS_OPORTUNIDADE = [...SECRETARIAS_PADRAO.filter((s) => s !== "Voluntariado"), "Grupos de FV", "Outra"];

/** "dom., 08/11 · 19h às 21h" (pontual) ou "Quintas, 19h às 21h" (contínua). */
export function quandoDaOportunidade(op: { tipo: string; data: string | null; horario: string | null }) {
  if (op.tipo !== "pontual") return op.horario || "Contínua";
  const dia = op.data ? new Date(`${op.data}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }) : null;
  return [dia, op.horario].filter(Boolean).join(" · ") || "Data a combinar";
}

/** Aberta para os membros: não encerrada, dentro do prazo e, se pontual, com a data ainda por vir. */
export function estaAberta(op: { encerradaEm: Date | null; abertaAte: string | null; tipo: string; data: string | null }, hoje: string) {
  if (op.encerradaEm) return false;
  if (op.abertaAte && op.abertaAte < hoje) return false;
  return !(op.tipo === "pontual" && op.data && op.data < hoje);
}

/** Dia AAAA-MM-DD somado de n dias (datas das oportunidades são texto, sem fuso). */
export const somarDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

/** Aviso de segunda-feira (07/11/2026): uma tarefa pelo nome; várias, a contagem e até 3 no corpo. */
export function textoVoluntariadoDaSemana(ops: { titulo: string; tipo: string; data: string | null; horario: string | null }[]) {
  if (ops.length === 1) return { titulo: "Voluntariado esta semana", corpo: `${ops[0].titulo} (${quandoDaOportunidade(ops[0])}) precisa de ajuda. Toque para se oferecer.` };
  const linhas = ops.slice(0, 3).map((o) => `${o.titulo} (${quandoDaOportunidade(o)})`);
  return { titulo: `${ops.length} tarefas de voluntariado esta semana`, corpo: `${linhas.join("; ")}${ops.length > 3 ? "..." : ""}. Toque para se oferecer.` };
}

export function textoLembreteVoluntariado(op: { titulo: string; horario: string | null }) {
  return { titulo: `Amanhã: ${op.titulo}`, corpo: `Você se ofereceu para ajudar${op.horario ? `, ${op.horario}` : ""}. Obrigado! Se não puder ir, avise o responsável.` };
}
