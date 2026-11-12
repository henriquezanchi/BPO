/**
 * Faixas do spread (regra do usuário, 12/11/2026). Taxa por FAIXA FIXA, não progressiva: o total de membros ativos das
 * escolas do escopo decide UMA taxa, que vale no mês seguinte para tudo o que passar pelo Portal.
 * Ex.: 5.001 membros → 0,5% no mês seguinte. Sem acesso ao banco (usado também na tela).
 */
export const FAIXAS_SPREAD = [
  { de: 1, ate: 500, percentual: 2 },
  { de: 501, ate: 1500, percentual: 1.5 },
  { de: 1501, ate: 3000, percentual: 1 },
  { de: 3001, ate: 5000, percentual: 0.75 },
  { de: 5001, ate: 10000, percentual: 0.5 },
  { de: 10001, ate: Infinity, percentual: 0.25 },
] as const;

export type FaixaSpread = (typeof FAIXAS_SPREAD)[number];

export function faixaDoSpread(membros: number): FaixaSpread {
  return FAIXAS_SPREAD.find((f) => membros <= f.ate) ?? FAIXAS_SPREAD[FAIXAS_SPREAD.length - 1];
}

export const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Fixo nacional, abatido pelo spread do mês: fixo = máx(0, 3.000 − spread). */
export const FIXO_MENSAL = 3000;
export const fixoDoMes = (spread: number) => Math.max(0, FIXO_MENSAL - spread);
