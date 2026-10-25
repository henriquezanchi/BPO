/**
 * Categorias de custo de uma abertura (pedido do usuário 2026-10-25): as mesmas no orçamento detalhado e nas
 * despesas lançadas, para comparar orçado × gasto por item e medir o custo por nova matrícula (CAC).
 */
export const CATEGORIAS_CUSTO = [
  ["trafego", "Tráfego pago e divulgação"],
  ["impressao", "Impressos"],
  ["coffee_break", "Coffee break"],
  ["aluguel_equipamentos", "Aluguel de equipamentos"],
  ["estrutura", "Espaço e estrutura"],
  ["materiais", "Materiais"],
  ["outros", "Outros"],
] as const;

export type CategoriaCusto = (typeof CATEGORIAS_CUSTO)[number][0];
export const CHAVES_CUSTO = CATEGORIAS_CUSTO.map(([k]) => k) as [CategoriaCusto, ...CategoriaCusto[]];
export const rotuloCusto = (k: unknown) => CATEGORIAS_CUSTO.find(([c]) => c === k)?.[1] ?? (typeof k === "string" && k ? k : "Despesa");
