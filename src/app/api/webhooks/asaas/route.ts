import { confirmarPagamento } from "@/lib/asaas/confirm-payment";
import { db } from "@/lib/db";

// Espelha diretamente o enum de status da autorização no Asaas (ver
// asaas/client.ts) — CREATED é o estado inicial (aluno ainda não pagou o
// QR code), não precisa de tratamento especial aqui.
const EVENTO_PARA_STATUS: Record<string, "ACTIVE" | "CANCELLED" | "REFUSED" | "EXPIRED"> = {
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED: "ACTIVE",
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED: "CANCELLED",
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED: "REFUSED",
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED: "EXPIRED",
};

/**
 * Recebe eventos do Asaas — precisa ser cadastrado no painel do Asaas
 * (Integrações > Webhooks) com uma URL PÚBLICA (não funciona contra
 * localhost, o Asaas precisa alcançar esta rota de fora) e o mesmo token em
 * ASAAS_WEBHOOK_TOKEN, configurado como "Token de acesso" no cadastro do
 * webhook lá. Dois grupos de evento:
 * - PAYMENT_RECEIVED/PAYMENT_CONFIRMED: confirmação de pagamento (fallback:
 *   sem URL pública, ainda funciona via polling — ver checkChargeStatus).
 * - PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*: mudança de status da
 *   autorização de débito automático (ver pix-automatico-actions.ts) —
 *   fallback via polling em checkPixAutomaticoStatus.
 */
export async function POST(req: Request) {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (tokenEsperado) {
    const tokenRecebido = req.headers.get("asaas-access-token");
    if (tokenRecebido !== tokenEsperado) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const body = (await req.json()) as {
    event?: string;
    payment?: { id?: string };
    pixAutomaticRecurringAuthorization?: { id?: string };
  };

  if ((body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") && body.payment?.id) {
    const charge = await db.paymentCharge.findUnique({ where: { asaasPaymentId: body.payment.id } });
    if (charge) await confirmarPagamento(charge.id);
  }

  const novoStatus = body.event ? EVENTO_PARA_STATUS[body.event] : undefined;
  if (novoStatus && body.pixAutomaticRecurringAuthorization?.id) {
    await db.member.updateMany({
      where: { pixAutomaticAuthorizationId: body.pixAutomaticRecurringAuthorization.id },
      data: { pixAutomaticStatus: novoStatus, pixAutomaticActivatedAt: novoStatus === "ACTIVE" ? new Date() : undefined },
    });
  }

  return new Response("ok", { status: 200 });
}
