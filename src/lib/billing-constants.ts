// Percentual da cobrança que fica com a filial (decisão do usuário, 2026-09-18). Desde 25/10/2026 toda cobrança sai
// pela subconta Asaas da filial (lib/asaas/conta-escola.ts) e só a margem do BPO (100% - isso) vai por split para a
// conta principal (lib/asaas/split.ts); sem subconta ligada, a filial não cobra on-line. Fora de payment-actions.ts
// ("use server" só exporta async function) para ser reaproveitado no cálculo de repasse esperado (director-data.ts).
export const PERCENTUAL_SPLIT_ESCOLA = 98;
