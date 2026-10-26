"use server";

import { exigirEscritaMercurio } from "@/lib/mercurio-escrita";
import { asaasCreatePixCharge, asaasFindOrCreateCustomer, asaasGetPixQrCode } from "@/lib/asaas/client";
import { contaDaEscolaId } from "@/lib/asaas/conta-escola";
import { splitDoBpo } from "@/lib/asaas/split";
import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { confirmarRecargaFortuna } from "@/lib/fortuna/confirmar-recarga";

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
  exigirEscritaMercurio(member);
  if (!Number.isFinite(valor) || valor < VALOR_MINIMO || valor > VALOR_MAXIMO) {
    throw new Error(`Valor deve estar entre ${VALOR_MINIMO} e ${VALOR_MAXIMO}.`);
  }
  if (!member.fortunaClientId) throw new Error("Sua conta ainda não está vinculada ao Fortuna — fale com a secretaria.");

  // Sempre pela subconta da filial (regra do usuário 2026-10-25).
  const conta = await contaDaEscolaId(member.schoolId);
  const cliente = await asaasFindOrCreateCustomer(member.name, cpf, member.email ?? undefined, conta);

  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 1);
  const dueDate = vencimento.toISOString().slice(0, 10);

  const split = await splitDoBpo(valor, conta);
  const pagamento = await asaasCreatePixCharge(cliente.id, valor, `Recarga Fortuna — ${member.name}`, dueDate, split, conta);
  const qrcode = await asaasGetPixQrCode(pagamento.id, conta);

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

/** Tela do aluno: confere a recarga (mesma função do webhook e da rotina, ver fortuna/confirmar-recarga.ts). */
export async function checkFortunaTopUpStatus(memberId: string, chargeId: string) {
  await requireAuthenticatedMember(memberId);
  const charge = await db.fortunaTopUpCharge.findUniqueOrThrow({ where: { id: chargeId }, select: { memberId: true } });
  if (charge.memberId !== memberId) throw new Error("Cobrança não pertence a este membro.");
  return { status: await confirmarRecargaFortuna(chargeId) };
}
