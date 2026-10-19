/** Constantes dos grupos do Portal — sem acesso ao banco, usadas também no navegador. Regras em grupos-portal.ts. */
export const TIPOS_GRUPO = {
  GAF: { nome: "GAF", completo: "Grupo de Acompanhamento Filosófico", doPortal: true },
  GDVE: { nome: "GDVE", completo: "GDVE", doPortal: true },
  SEC: { nome: "Secretaria", completo: "Secretaria da filial", doPortal: true },
  BF: { nome: "Grupo Feminino", completo: "Grupo Feminino", doPortal: false },
  BM: { nome: "Grupo Masculino", completo: "Grupo Masculino", doPortal: false },
  CS: { nome: "Grupo de Segurança", completo: "Grupo de Segurança", doPortal: false },
} as const;
export type TipoGrupo = keyof typeof TIPOS_GRUPO;
export const TIPOS_FV = ["BF", "BM", "CS"] as const;
export const ehTipoGrupo = (t: string): t is TipoGrupo => Object.hasOwn(TIPOS_GRUPO, t);

export const MODALIDADES: Record<string, string> = { presencial: "Presencial", online: "Online", misto: "Presencial e online" };
export const FREQUENCIAS: Record<number, string> = { 1: "Semanal", 2: "Quinzenal", 4: "A cada 4 semanas" };
