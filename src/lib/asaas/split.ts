import { asaasGetPixFeeStatus, type AsaasSplit, type ContaAsaas } from "@/lib/asaas/client";
import { walletPrincipal } from "@/lib/asaas/conta-escola";
import { PERCENTUAL_SPLIT_ESCOLA } from "@/lib/billing-constants";
import { db } from "@/lib/db";
import { spreadDoMes } from "@/lib/spread";

/**
 * Divisão das cobranças. Desde 2026-10-25 (regra do usuário) a cobrança é EMITIDA pela subconta da filial, então o
 * que é da escola já fica nela; o split manda só a margem do BPO para a conta principal, em `fixedValue`.
 * A taxa do Asaas é descontada da subconta que emite; a margem do BPO é sobre o valor da contribuição.
 *
 * Desde 12/11/2026 a margem segue a FAIXA do mês (lib/spread.ts): o total de ativos das escolas do escopo decide uma
 * taxa única (2% até 500 membros ... 0,25% acima de 10.000). Antes era 2% fixo (PERCENTUAL_SPLIT_ESCOLA = 98).
 */
async function percentualDoBpo(): Promise<number> {
  try {
    return (await spreadDoMes()).percentual;
  } catch (e) {
    // Sem contagem possível, a cobrança não pode parar: usa a última faixa gravada; sem nenhuma, a regra antiga.
    console.error(`Spread do mês indisponível: ${(e as Error).message}`);
    const ultima = await db.resumoNacional
      .findFirst({ where: { chave: { startsWith: "spread:" } }, orderBy: { chave: "desc" } })
      .catch(() => null);
    return (ultima?.dados as { percentual?: number } | undefined)?.percentual ?? 100 - PERCENTUAL_SPLIT_ESCOLA;
  }
}

const margem = async (valor: number) => Math.round(((await percentualDoBpo()) / 100) * valor * 100) / 100;

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
  const valorBpo = Math.min(await margem(valor), disponivel);
  return valorBpo > 0 ? [{ walletId: await walletPrincipal(), fixedValue: valorBpo }] : [];
}

/**
 * Cartão: a margem é sobre o valor base (contribuição + recarga). `liquido` é o que sobra depois da taxa do cartão;
 * quando a escola absorve a taxa (não repassa ao aluno), a margem fica limitada a ele, que é o que o Asaas valida.
 */
export async function splitDoBpoCartao(valorBase: number, liquido = Infinity): Promise<AsaasSplit[]> {
  if (liquido <= 0) throw new ValorNaoCobreCustos();
  const valorBpo = Math.min(await margem(valorBase), Math.round(liquido * 100) / 100);
  return valorBpo > 0 ? [{ walletId: await walletPrincipal(), fixedValue: valorBpo }] : [];
}
