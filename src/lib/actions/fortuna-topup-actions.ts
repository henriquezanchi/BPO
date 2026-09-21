"use server";

import { asaasCreatePixCharge, asaasFindOrCreateCustomer, asaasGetPaymentStatus, asaasGetPixQrCode } from "@/lib/asaas/client";
import { calcularSplitEscola } from "@/lib/asaas/split";
import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { fortunaCreditarSaldo } from "@/lib/fortuna/client";

const VALOR_MINIMO = 5;
const VALOR_MAXIMO = 1000;

/**
 * Cria uma cobrança PIX real (Asaas) pra recarga da carteira Fortuna. O
 * crédito em si é automático assim que o pagamento é confirmado (ver
 * checkFortunaTopUpStatus) — endpoint de escrita do Fortuna confirmado ao
 * vivo em 2026-09-21 (PUT /balance/with-receipt, ver fortuna/client.ts).
 * Mesmo split da contribuição (decisão do usuário 2026-09-21) — é dinheiro
 * da lanchonete da escola, não receita do BPO, então usa o mesmo cálculo de
 * calcularSplitEscola (asaas/split.ts) já configurado pra contribuição.
 *
 * Valor vem do MEMBRO (ele escolhe quanto recarregar, diferente da
 * contribuição que é sempre recalculada da composição) — só validado
 * dentro de uma faixa razoável. `branchId` vem do seletor de filial do
 * próprio painel de recarga (precisa saber em qual saldo creditar).
 */
export async function createFortunaTopUpCharge(memberId: string, valor: number, cpf: string, branchId: number) {
  const member = await requireAuthenticatedMember(memberId);
  if (!Number.isFinite(valor) || valor < VALOR_MINIMO || valor > VALOR_MAXIMO) {
    throw new Error(`Valor deve estar entre ${VALOR_MINIMO} e ${VALOR_MAXIMO}.`);
  }
  if (!member.fortunaClientId) throw new Error("Sua conta ainda não está vinculada ao Fortuna — fale com a secretaria.");

  const cliente = await asaasFindOrCreateCustomer(member.name, cpf, member.email ?? undefined);

  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 1);
  const dueDate = vencimento.toISOString().slice(0, 10);

  const split = member.school.asaasWalletId ? [await calcularSplitEscola(valor, member.school.asaasWalletId)] : undefined;
  const pagamento = await asaasCreatePixCharge(cliente.id, valor, `Recarga Fortuna — ${member.name}`, dueDate, split);
  const qrcode = await asaasGetPixQrCode(pagamento.id);

  const charge = await db.fortunaTopUpCharge.create({
    data: {
      memberId,
      amount: valor,
      branchId,
      asaasCustomerId: cliente.id,
      asaasPaymentId: pagamento.id,
      pixPayload: qrcode.payload,
      pixQrCodeBase64: qrcode.encodedImage,
    },
  });

  return { chargeId: charge.id, pixPayload: qrcode.payload, pixQrCodeBase64: qrcode.encodedImage, amount: valor };
}

/**
 * Checa o status real no Asaas; ao detectar pagamento, credita automaticamente
 * no Fortuna (PUT /balance/with-receipt). Se o crédito automático falhar
 * (membro desvinculado, API fora do ar etc.), a cobrança fica marcada como
 * paga mas SEM `launchedAt` — cai na fila de exceção da FortunaTab pra
 * lançamento manual, com o erro salvo em `autoCreditError` pra diagnóstico.
 */
export async function checkFortunaTopUpStatus(memberId: string, chargeId: string) {
  const member = await requireAuthenticatedMember(memberId);

  const charge = await db.fortunaTopUpCharge.findUniqueOrThrow({ where: { id: chargeId } });
  if (charge.memberId !== memberId) throw new Error("Cobrança não pertence a este membro.");
  if (charge.status === "pago") return { status: "pago" as const };

  const pagamento = await asaasGetPaymentStatus(charge.asaasPaymentId);
  if (pagamento.status !== "RECEIVED" && pagamento.status !== "CONFIRMED") {
    return { status: "pendente" as const };
  }

  await db.fortunaTopUpCharge.update({ where: { id: chargeId }, data: { status: "pago", paidAt: new Date() } });

  try {
    if (!member.fortunaClientId) throw new Error("Membro sem fortunaClientId vinculado.");
    await fortunaCreditarSaldo(member.fortunaClientId, charge.branchId, Number(charge.amount));
    await db.fortunaTopUpCharge.update({
      where: { id: chargeId },
      data: { launchedAt: new Date(), launchedBy: "Automático (Asaas → Fortuna)" },
    });
  } catch (e) {
    await db.fortunaTopUpCharge.update({ where: { id: chargeId }, data: { autoCreditError: (e as Error).message } });
  }

  return { status: "pago" as const };
}
