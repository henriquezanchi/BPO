"use server";

import {
  asaasCancelPayment,
  asaasCreateCreditCardCharge,
  asaasCreatePixCharge,
  asaasFindOrCreateCustomer,
  asaasGetCreditCardFeeStatus,
  asaasGetPaymentStatus,
  asaasGetPixQrCode,
} from "@/lib/asaas/client";
import { confirmarPagamento } from "@/lib/asaas/confirm-payment";
import { calcularSplitEscola, calcularSplitEscolaCartao } from "@/lib/asaas/split";
import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import type { PaymentCharge } from "@prisma/client";

const FORTUNA_TOPUP_MINIMO = 5;
const FORTUNA_TOPUP_MAXIMO = 1000;

/** Converte uma linha do banco pro mesmo formato que createContributionCharge devolve — usado tanto pro reaproveitamento quanto pra recuperação de cobrança pendente (ver getPendingContributionCharge). */
function paraResultadoCobranca(charge: PaymentCharge) {
  const amount = Number(charge.amount);
  const fortunaTopUpAmount = charge.fortunaTopUpAmount ? Number(charge.fortunaTopUpAmount) : 0;
  if (charge.billingType === "CREDIT_CARD") {
    const cardSurcharge = charge.cardSurcharge ? Number(charge.cardSurcharge) : 0;
    return {
      chargeId: charge.id,
      metodo: "CREDIT_CARD" as const,
      invoiceUrl: charge.invoiceUrl!,
      amount,
      fortunaTopUpAmount,
      totalCobrado: amount + fortunaTopUpAmount + cardSurcharge,
    };
  }
  return {
    chargeId: charge.id,
    metodo: "PIX" as const,
    pixPayload: charge.pixPayload!,
    pixQrCodeBase64: charge.pixQrCodeBase64!,
    amount,
    fortunaTopUpAmount,
    totalCobrado: amount + fortunaTopUpAmount,
  };
}

/**
 * Cria (ou reaproveita) uma cobrança real no Asaas pra 1 mês de
 * contribuição — PIX (padrão, embutido na tela) ou cartão de crédito
 * (checkout hospedado pelo Asaas, ver invoiceUrl). Valor da contribuição
 * vem SEMPRE recalculado no servidor a partir da composição do membro
 * (nunca confia num valor vindo do client — é dinheiro real). CPF é
 * passado direto pro Asaas pra achar/criar o cliente, nunca persistido
 * aqui (mesma minimização já usada pra derivar a senha inicial de login a
 * partir do CPF do Mercúrio).
 *
 * `fortunaTopUpAmount` (opcional): aproveita o aluno já estar pagando a
 * contribuição pra sugerir também recarregar o Fortuna, tudo numa cobrança
 * só (decisão do usuário 2026-09-22) — usa o MESMO split 98/2 da
 * contribuição normal (é dinheiro da lanchonete, igual ao fluxo dedicado em
 * fortuna-topup-actions.ts). Creditado automaticamente na confirmação, ver
 * confirm-payment.ts.
 */
export async function createContributionCharge(
  memberId: string,
  year: number,
  month: number,
  cpf: string,
  opts?: { metodo?: "PIX" | "CREDIT_CARD"; fortunaTopUpAmount?: number },
) {
  const member = await requireAuthenticatedMember(memberId);
  const metodo = opts?.metodo ?? "PIX";
  const fortunaTopUpAmount = opts?.fortunaTopUpAmount ? Math.round(opts.fortunaTopUpAmount * 100) / 100 : 0;
  if (fortunaTopUpAmount > 0) {
    if (fortunaTopUpAmount < FORTUNA_TOPUP_MINIMO || fortunaTopUpAmount > FORTUNA_TOPUP_MAXIMO) {
      throw new Error(`Recarga Fortuna deve estar entre ${formatBRL(FORTUNA_TOPUP_MINIMO)} e ${formatBRL(FORTUNA_TOPUP_MAXIMO)}.`);
    }
    if (!member.fortunaClientId) throw new Error("Sua conta ainda não está vinculada ao Fortuna — fale com a secretaria.");
  }

  // SEMPRE reaproveita uma cobrança pendente já existente pro mês, seja
  // qual for o método/recarga combinada dela — bug real relatado pelo
  // usuário 2026-09-22: saiu da tela no meio do pagamento (contribuição +
  // recarga Fortuna), a tela não voltou mais, e clicar em "pagar outubro"
  // de novo criava uma cobrança NOVA (a antiga ficava órfã, pendente pra
  // sempre no Asaas, arriscando cobrar o aluno 2x). Ver também
  // getPendingContributionCharge (chamada ao abrir a tela) e
  // cancelarCobrancaContribuicaoPendente (escape hatch se a cobrança antiga
  // estiver mesmo obsoleta).
  const existente = await db.paymentCharge.findFirst({
    where: { memberId, referenceYear: year, referenceMonth: month, status: "pendente" },
    orderBy: { createdAt: "desc" },
  });
  if (existente) return paraResultadoCobranca(existente);

  const itens = await db.contributionCompositionItem.findMany({ where: { memberId } });
  const valor = itens.reduce((soma, i) => soma + Number(i.amount), 0);
  if (valor <= 0) throw new Error("Composição da contribuição está vazia — nada a cobrar.");
  const valorBase = valor + fortunaTopUpAmount;

  const cliente = await asaasFindOrCreateCustomer(member.name, cpf, member.email ?? undefined);

  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 2);
  const dueDate = vencimento.toISOString().slice(0, 10);

  const nomeMes = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  const descricao =
    fortunaTopUpAmount > 0
      ? `Contribuição ${nomeMes}/${year} + Recarga Fortuna ${formatBRL(fortunaTopUpAmount)} — ${member.name}`
      : `Contribuição ${nomeMes}/${year} — ${member.name}`;

  if (metodo === "CREDIT_CARD") {
    const { percentual, fixo } = await asaasGetCreditCardFeeStatus();
    // Repassa a taxa real do cartão ao aluno (decisão do usuário
    // 2026-09-22) — "gross-up" pra que o valor líquido recebido (depois do
    // Asaas descontar a taxa dele) bata exatamente com valorBase.
    const valorCartao = Math.round(((valorBase + fixo) / (1 - percentual / 100)) * 100) / 100;
    const split = member.school.asaasWalletId ? [calcularSplitEscolaCartao(valorBase, member.school.asaasWalletId)] : undefined;
    const pagamento = await asaasCreateCreditCardCharge(cliente.id, valorCartao, descricao, dueDate, split);
    if (!pagamento.invoiceUrl) throw new Error("Asaas não retornou o link de pagamento do cartão.");

    const charge = await db.paymentCharge.create({
      data: {
        memberId,
        referenceYear: year,
        referenceMonth: month,
        amount: valor,
        billingType: "CREDIT_CARD",
        cardSurcharge: Math.round((valorCartao - valorBase) * 100) / 100,
        fortunaTopUpAmount: fortunaTopUpAmount > 0 ? fortunaTopUpAmount : null,
        asaasCustomerId: cliente.id,
        asaasPaymentId: pagamento.id,
        invoiceUrl: pagamento.invoiceUrl,
      },
    });
    return { chargeId: charge.id, metodo: "CREDIT_CARD" as const, invoiceUrl: pagamento.invoiceUrl, amount: valor, fortunaTopUpAmount, totalCobrado: valorCartao };
  }

  const split = member.school.asaasWalletId ? [await calcularSplitEscola(valorBase, member.school.asaasWalletId)] : undefined;
  const pagamento = await asaasCreatePixCharge(cliente.id, valorBase, descricao, dueDate, split);
  const qrcode = await asaasGetPixQrCode(pagamento.id);

  const charge = await db.paymentCharge.create({
    data: {
      memberId,
      referenceYear: year,
      referenceMonth: month,
      amount: valor,
      billingType: "PIX",
      fortunaTopUpAmount: fortunaTopUpAmount > 0 ? fortunaTopUpAmount : null,
      asaasCustomerId: cliente.id,
      asaasPaymentId: pagamento.id,
      pixPayload: qrcode.payload,
      pixQrCodeBase64: qrcode.encodedImage,
    },
  });

  return {
    chargeId: charge.id,
    metodo: "PIX" as const,
    pixPayload: qrcode.payload,
    pixQrCodeBase64: qrcode.encodedImage,
    amount: valor,
    fortunaTopUpAmount,
    totalCobrado: valorBase,
  };
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

/**
 * Chamada ao ABRIR a tela de pagamento de um mês (antes de mostrar o
 * formulário) — se já existe uma cobrança pendente pra esse mês (aluno
 * saiu no meio do fluxo antes, ver createContributionCharge), volta direto
 * pra ela em vez de deixar o aluno preencher tudo de novo e arriscar gerar
 * uma 2ª cobrança pro mesmo mês.
 */
export async function getPendingContributionCharge(memberId: string, year: number, month: number) {
  await requireAuthenticatedMember(memberId);
  const existente = await db.paymentCharge.findFirst({
    where: { memberId, referenceYear: year, referenceMonth: month, status: "pendente" },
    orderBy: { createdAt: "desc" },
  });
  return existente ? paraResultadoCobranca(existente) : null;
}

/** Escape hatch: cancela a cobrança pendente atual (ex: aluno quer trocar de método, ou a antiga travou) pra poder gerar uma nova do zero. */
export async function cancelarCobrancaContribuicaoPendente(memberId: string, chargeId: string) {
  await requireAuthenticatedMember(memberId);
  const charge = await db.paymentCharge.findUniqueOrThrow({ where: { id: chargeId } });
  if (charge.memberId !== memberId) throw new Error("Cobrança não pertence a este membro.");
  if (charge.status !== "pendente") throw new Error("Só é possível cancelar uma cobrança pendente.");

  await asaasCancelPayment(charge.asaasPaymentId);
  await db.paymentCharge.update({ where: { id: chargeId }, data: { status: "cancelado" } });
}
