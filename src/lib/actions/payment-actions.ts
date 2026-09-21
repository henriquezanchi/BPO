"use server";

import { asaasCreatePixCharge, asaasFindOrCreateCustomer, asaasGetPaymentStatus, asaasGetPixQrCode } from "@/lib/asaas/client";
import { confirmarPagamento } from "@/lib/asaas/confirm-payment";
import { calcularSplitEscola } from "@/lib/asaas/split";
import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Cria (ou reaproveita) uma cobrança PIX real no Asaas pra 1 mês de
 * contribuição. Valor vem SEMPRE recalculado no servidor a partir da
 * composição do membro (nunca confia num valor vindo do client — é
 * dinheiro real). CPF é passado direto pro Asaas pra achar/criar o
 * cliente, nunca persistido aqui (mesma minimização já usada pra derivar
 * a senha inicial de login a partir do CPF do Mercúrio).
 */
export async function createContributionCharge(memberId: string, year: number, month: number, cpf: string) {
  const member = await requireAuthenticatedMember(memberId);

  const existente = await db.paymentCharge.findFirst({
    where: { memberId, referenceYear: year, referenceMonth: month, status: "pendente" },
    orderBy: { createdAt: "desc" },
  });
  if (existente?.pixPayload && existente.pixQrCodeBase64) {
    return { chargeId: existente.id, pixPayload: existente.pixPayload, pixQrCodeBase64: existente.pixQrCodeBase64, amount: Number(existente.amount) };
  }

  const itens = await db.contributionCompositionItem.findMany({ where: { memberId } });
  const valor = itens.reduce((soma, i) => soma + Number(i.amount), 0);
  if (valor <= 0) throw new Error("Composição da contribuição está vazia — nada a cobrar.");

  const cliente = await asaasFindOrCreateCustomer(member.name, cpf, member.email ?? undefined);

  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 2);
  const dueDate = vencimento.toISOString().slice(0, 10);

  const nomeMes = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  const split = member.school.asaasWalletId ? [await calcularSplitEscola(valor, member.school.asaasWalletId)] : undefined;
  const pagamento = await asaasCreatePixCharge(cliente.id, valor, `Contribuição ${nomeMes}/${year} — ${member.name}`, dueDate, split);
  const qrcode = await asaasGetPixQrCode(pagamento.id);

  const charge = await db.paymentCharge.create({
    data: {
      memberId,
      referenceYear: year,
      referenceMonth: month,
      amount: valor,
      asaasCustomerId: cliente.id,
      asaasPaymentId: pagamento.id,
      pixPayload: qrcode.payload,
      pixQrCodeBase64: qrcode.encodedImage,
    },
  });

  return { chargeId: charge.id, pixPayload: qrcode.payload, pixQrCodeBase64: qrcode.encodedImage, amount: valor };
}

/** Checa o status real no Asaas (fallback do webhook, útil enquanto o Portal não tem URL pública pra receber webhook) e confirma se já foi pago. */
export async function checkChargeStatus(memberId: string, chargeId: string) {
  await requireAuthenticatedMember(memberId);

  const charge = await db.paymentCharge.findUniqueOrThrow({ where: { id: chargeId } });
  if (charge.memberId !== memberId) throw new Error("Cobrança não pertence a este membro.");
  if (charge.status === "pago") return { status: "pago" as const };

  const pagamento = await asaasGetPaymentStatus(charge.asaasPaymentId);
  if (pagamento.status === "RECEIVED" || pagamento.status === "CONFIRMED") {
    await confirmarPagamento(charge.id);
    return { status: "pago" as const };
  }
  return { status: "pendente" as const };
}
