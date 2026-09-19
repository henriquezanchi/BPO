// Taxa do BPO por cobrança (decisão do usuário, 2026-09-18) — o resto
// (100% - isso) vai pra escola via split, quando a escola já tiver
// subconta Asaas configurada (School.asaasWalletId, ver
// scripts/create-asaas-subaccount.ts). Enquanto a escola não tiver
// subconta, a cobrança NÃO leva split — 100% fica na conta do BPO como
// antes, então nenhuma escola nova fica com dinheiro parado sem querer.
// Extraído pra fora de payment-actions.ts ("use server" só pode exportar
// async function) pra poder ser reaproveitado no cálculo de repasse
// esperado (director-data.ts).
export const PERCENTUAL_SPLIT_ESCOLA = 98;
