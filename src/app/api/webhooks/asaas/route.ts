import { confirmarPagamento } from "@/lib/asaas/confirm-payment";
import { db } from "@/lib/db";

/**
 * Recebe eventos do Asaas (PAYMENT_RECEIVED/PAYMENT_CONFIRMED) — precisa
 * ser cadastrado no painel do Asaas (Integrações > Webhooks) com uma URL
 * PÚBLICA (não funciona contra localhost, o Asaas precisa alcançar esta
 * rota de fora) e o mesmo token em ASAAS_WEBHOOK_TOKEN, configurado como
 * "Token de acesso" no cadastro do webhook lá.
 *
 * Enquanto não tem URL pública (ainda em dev local), a confirmação de
 * pagamento acontece só via polling (checkChargeStatus) — não trava nada,
 * mas é mais lento que a confirmação instantânea por webhook.
 */
export async function POST(req: Request) {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (tokenEsperado) {
    const tokenRecebido = req.headers.get("asaas-access-token");
    if (tokenRecebido !== tokenEsperado) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const body = (await req.json()) as { event?: string; payment?: { id?: string } };
  if ((body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") && body.payment?.id) {
    const charge = await db.paymentCharge.findUnique({ where: { asaasPaymentId: body.payment.id } });
    if (charge) await confirmarPagamento(charge.id);
  }

  return new Response("ok", { status: 200 });
}
