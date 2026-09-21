import { asaasGetPixFeeStatus, type AsaasSplit } from "@/lib/asaas/client";
import { PERCENTUAL_SPLIT_ESCOLA } from "@/lib/billing-constants";

/**
 * Split da escola usando `fixedValue` (não `percentualValue`) — decisão do
 * usuário (2026-09-21): o BPO deve ficar com a taxa do Asaas + a margem de
 * PERCENTUAL_SPLIT_ESCOLA, não com uma fatia diminuída pela taxa. Como o
 * split percentual do Asaas incide sobre o valor LÍQUIDO (já descontada a
 * taxa), usar percentualValue faria escola e BPO dividirem o custo da taxa
 * proporcionalmente — em vez disso, calculamos aqui o valor exato que a
 * escola deve receber (valor - taxa real - margem do BPO) e mandamos como
 * fixedValue; o que sobrar (margem do BPO + taxa, se houve) fica
 * automaticamente na conta que criou a cobrança.
 */
export async function calcularSplitEscola(valor: number, walletId: string): Promise<AsaasSplit> {
  const { isento, taxaFixa } = await asaasGetPixFeeStatus();
  const taxaReal = isento ? 0 : taxaFixa;
  const margemBpo = ((100 - PERCENTUAL_SPLIT_ESCOLA) / 100) * valor;
  const valorEscola = Math.max(0, Math.round((valor - taxaReal - margemBpo) * 100) / 100);
  return { walletId, fixedValue: valorEscola };
}
