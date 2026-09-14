/**
 * Códigos reais aceitos pelos <select> de Estado Civil/Escolaridade na aba
 * PESSOAIS do Mercúrio (confirmados ao vivo, 2026-09-14 — inventário dos
 * <option> da ficha real). O Portal grava e envia o CÓDIGO (value), não o
 * texto, pra bater exatamente com o que o Mercúrio espera de volta.
 */
export const ESTADO_CIVIL_OPCOES = [
  { value: "???", label: "Não informado" },
  { value: "SOL", label: "Solteiro(a)" },
  { value: "CAS", label: "Casado(a)" },
  { value: "UNE", label: "União Estável" },
  { value: "DIV", label: "Divorciado(a)" },
  { value: "SEP", label: "Separado(a)" },
  { value: "VIU", label: "Viúvo(a)" },
] as const;

export const ESCOLARIDADE_OPCOES = [
  { value: "???", label: "Não informada" },
  { value: "GR1", label: "Primeiro Grau" },
  { value: "GR2", label: "Segundo Grau" },
  { value: "GR4", label: "Superior Incompleto" },
  { value: "GR3", label: "Superior" },
  { value: "GRP", label: "Pós-Graduação" },
  { value: "GRM", label: "Mestrado" },
  { value: "GRO", label: "Doutorado" },
] as const;
