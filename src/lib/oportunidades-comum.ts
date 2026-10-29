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
