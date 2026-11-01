import { notificarErroSuporte } from "@/lib/error-notify";
import { timingSafeEqual } from "node:crypto";
import {processEventRefund} from "@/lib/event-refunds";
import {confirmEventPayment} from "@/lib/event-payments";
import {asaasGetPaymentStatus} from "@/lib/asaas/client";
import { contaDeLeituraId } from "@/lib/asaas/conta-escola";
import { confirmarPagamento } from "@/lib/asaas/confirm-payment";
import { confirmarRecargaFortuna } from "@/lib/fortuna/confirmar-recarga";
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
  if (!tokenEsperado) return new Response("webhook not configured", { status: 503 });
  // Comparação em tempo constante, como no webhook de saque (31/10/2026).
  const recebido = Buffer.from(req.headers.get("asaas-access-token") ?? "");
  const esperado = Buffer.from(tokenEsperado);
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    event?: string;
    payment?: { id?: string };
    pixAutomaticRecurringAuthorization?: { id?: string };
  };

  if ((body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") && body.payment?.id) {
    const charge = await db.paymentCharge.findUnique({ where: { asaasPaymentId: body.payment.id } });
    if (charge) await confirmarPagamento(charge.id);
    // Matrícula pelo site: confere na subconta e avisa a Escolástica.
    const matricula=await db.matriculaOnline.findUnique({where:{asaasPaymentId:body.payment.id},select:{id:true}});
    if(matricula)await (await import("@/lib/matricula-online")).conferirPagamento(matricula.id);
    // Recarga do Fortuna (26/10/2026): antes só a tela do aluno confirmava.
    const recarga=await db.fortunaTopUpCharge.findUnique({where:{asaasPaymentId:body.payment.id},select:{id:true}});
    if(recarga)await confirmarRecargaFortuna(recarga.id);
    const registration=await db.eventRegistration.findUnique({where:{asaasPaymentId:body.payment.id},include:{event:{select:{schoolId:true}}}});
    if(registration){
      const payment=await asaasGetPaymentStatus(body.payment.id,await contaDeLeituraId(registration.event.schoolId));
      // Responde 200 mesmo sem confirmar (01/11/2026): com erro, o Asaas reenvia e, depois de várias falhas, pode
      // pausar a fila de avisos da conta inteira (parando a confirmação dos outros pagamentos). A conferência fica
      // com a tela do aluno e com a Economia, avisada quando o valor diverge.
      const confirmado=["RECEIVED","CONFIRMED"].includes(payment.status);
      const valorConfere=registration.amount===null||Math.round(Number(registration.amount)*100)===Math.round(payment.value*100);
      if(confirmado&&valorConfere){
        await confirmEventPayment(registration.id);
        await processEventRefund(registration.id);
      }else if(confirmado){
        console.error("[Webhook Asaas] valor divergente na inscrição",registration.id);
        await notificarErroSuporte({message:`Inscrição ${registration.id}: valor pago diverge do valor da inscrição. Conferir na Economia.`,path:"/api/webhooks/asaas",routeType:"webhook"});
      }
    }
  }

  if(body.event?.startsWith("PAYMENT_REFUND")&&body.payment?.id){
    const registration=await db.eventRegistration.findUnique({where:{asaasPaymentId:body.payment.id}});
    if(registration)await processEventRefund(registration.id);
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
