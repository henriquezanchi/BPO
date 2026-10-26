import { asaasGetPixFeeStatus, type AsaasSplit, type ContaAsaas } from "@/lib/asaas/client";
import { walletPrincipal } from "@/lib/asaas/conta-escola";
import { PERCENTUAL_SPLIT_ESCOLA } from "@/lib/billing-constants";

/**
 * Divisão das cobranças. Desde 2026-10-25 (regra do usuário) a cobrança é EMITIDA pela subconta da filial, então o
 * que é da escola já fica nela; o split manda só a margem do BPO (100 − PERCENTUAL_SPLIT_ESCOLA % do valor) para a
 * conta principal, em `fixedValue`. Antes era o contrário (cobrança na principal e split da parte da escola).
 * A taxa do Asaas é descontada da subconta que emite; a margem do BPO continua sobre o valor cheio, como antes.
 */
const margem = (valor: number) => Math.round(((100 - PERCENTUAL_SPLIT_ESCOLA) / 100) * valor * 100) / 100;

export class ValorNaoCobreCustos extends Error {
  constructor() {
    super("A contribuição não cobre os custos de processamento. Peça conferência à Economia.");
  }
}

/** Pix (e cobrança em aberto do site de matrículas): margem limitada a "valor − taxa", que é o que o Asaas valida. */
export async function splitDoBpo(valor: number, conta: ContaAsaas): Promise<AsaasSplit[]> {
  const { taxaFixa } = await asaasGetPixFeeStatus(conta);
  // O Asaas valida o split contra "valor − taxa" mesmo quando o Pix sai isento (erro real em 19/10/2026).
  const disponivel = Math.round((valor - taxaFixa) * 100) / 100;
  if (disponivel <= 0) throw new ValorNaoCobreCustos();
  const valorBpo = Math.min(margem(valor), disponivel);
  return valorBpo > 0 ? [{ walletId: await walletPrincipal(), fixedValue: valorBpo }] : [];
}

/** Cartão: a taxa já foi repassada ao aluno no valor cobrado (payment-actions.ts); a margem é sobre o valor base. */
export async function splitDoBpoCartao(valorBase: number): Promise<AsaasSplit[]> {
  const valorBpo = margem(valorBase);
  return valorBpo > 0 ? [{ walletId: await walletPrincipal(), fixedValue: valorBpo }] : [];
}
