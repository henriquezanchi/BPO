/**
 * Solicitação de inclusão de pedagogo no Mercúrio (11/11/2026): partes usadas no servidor e na tela.
 * A formação segue o texto do Mercúrio (Integração → Pedagogos: "INSTRUTOR" ou "EM FORMAÇÃO").
 */
export const FORMACOES_PEDAGOGO = [
  ["EM FORMAÇÃO", "Em formação"],
  ["INSTRUTOR", "Instrutor"],
] as const;

export type FormacaoPedagogo = (typeof FORMACOES_PEDAGOGO)[number][0];

export const ehFormacao = (v: string): v is FormacaoPedagogo => FORMACOES_PEDAGOGO.some(([f]) => f === v);

export const rotuloFormacao = (v: string) => FORMACOES_PEDAGOGO.find(([f]) => f === v)?.[1] ?? v;

export type StatusSolicitacaoPedagogo = "pendente" | "incluida" | "recusada" | "cancelada";

export const ROTULO_STATUS: Record<StatusSolicitacaoPedagogo, string> = {
  pendente: "Aguardando inclusão",
  incluida: "Incluída no Mercúrio",
  recusada: "Não incluída",
  cancelada: "Cancelada",
};

export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 1000;

/** Texto do motivo já limpo, ou o erro a mostrar. */
export function validarMotivo(motivo: string): { ok: true; texto: string } | { ok: false; erro: string } {
  const texto = motivo.trim().replace(/\s+\n/g, "\n");
  if (texto.length < MOTIVO_MIN) return { ok: false, erro: "Conte em uma frase por que a pessoa deve entrar como pedagogo." };
  if (texto.length > MOTIVO_MAX) return { ok: false, erro: `O motivo passou de ${MOTIVO_MAX} caracteres.` };
  return { ok: true, texto };
}
