/**
 * Fuso da filial pela UF (Barra do Garças-MT é uma hora antes de Brasília). Módulo puro desde 31/10/2026, para a fila
 * do Mercúrio (que também roda por script) usar o mesmo mapa; atendimentos.ts reexporta.
 */
const FUSO_POR_UF: Record<string, string> = {
  MT: "America/Cuiaba",
  MS: "America/Campo_Grande",
  AM: "America/Manaus",
  RR: "America/Boa_Vista",
  RO: "America/Porto_Velho",
  AC: "America/Rio_Branco",
};

export const fusoDaEscola = (uf: string | null | undefined) => FUSO_POR_UF[(uf ?? "").toUpperCase()] ?? "America/Sao_Paulo";
