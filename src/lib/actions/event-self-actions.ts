"use server";

import { asaasDeleteEventPayment, asaasGetPaymentStatus } from "@/lib/asaas/client";
import { requireAuthenticatedMember } from "@/lib/auth";
import { temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { eventAudienceWhere, eventScopeWhere } from "@/lib/event-policy";
import { confirmEventPayment } from "@/lib/event-payments";
import { processarListaDeEspera } from "@/lib/event-waitlist";
import { revalidatePath } from "next/cache";

/**
 * Ações do próprio aluno sobre um evento (pedido do usuário 2026-10-22):
 * desistir da inscrição e lista de espera.
 *
 * Desistência:
 *  - gratuita: libera a vaga na hora;
 *  - PIX gerado e não pago: cancela a cobrança no Asaas antes de liberar
 *    (se o pagamento já caiu, confirma a inscrição em vez de cancelar);
 *  - já paga: não cancela por aqui. O reembolso automático só existe para
 *    evento cancelado pela filial; desistência paga passa pela Economia.
 */
type Resultado = { ok: true; mensagem: string } | { ok: false; erro: string };

function atualizar(eventId: string) {
  revalidatePath("/portal");
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${eventId}/recepcao`);
}

export async function cancelarMinhaInscricao(memberId: string, registrationId: string): Promise<Resultado> {
  await requireAuthenticatedMember(memberId);
  const r = await db.eventRegistration.findFirst({ where: { id: registrationId, memberId }, include: { event: true } });
  if (!r) return { ok: false, erro: "Inscrição não encontrada." };
  if (r.event.status !== "publicado" || r.event.startsAt <= new Date()) return { ok: false, erro: "Este evento já começou ou não aceita mais alterações." };

  const pagaDeVerdade = r.paid && Number(r.amount ?? 0) > 0;
  if (pagaDeVerdade) return { ok: false, erro: "Sua inscrição já foi paga. Para desistir e pedir a devolução, fale com a Economia da filial." };
  if (["criando", "revisao"].includes(r.paymentState)) return { ok: false, erro: "Sua cobrança está em conferência pela Economia. Fale com a secretaria para desistir." };

  // PIX gerado: confere no Asaas antes de mexer — se já foi pago, a inscrição vale.
  if (r.asaasPaymentId && !r.paid) {
    try {
      const pagamento = await asaasGetPaymentStatus(r.asaasPaymentId);
      if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(pagamento.status)) {
        await confirmEventPayment(r.id);
        atualizar(r.eventId);
        return { ok: false, erro: "O pagamento desta inscrição já foi recebido, então ela está confirmada. Para desistir, fale com a Economia." };
      }
      const removida = await asaasDeleteEventPayment(r.asaasPaymentId);
      if (!removida.deleted) throw new Error("Asaas não confirmou o cancelamento.");
    } catch {
      return { ok: false, erro: "Não foi possível cancelar a cobrança agora. Tente de novo em alguns minutos." };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.eventNotice.deleteMany({ where: { registrationId: r.id } });
    await tx.eventRegistration.delete({ where: { id: r.id } });
    await tx.eventAudit.create({ data: { eventId: r.eventId, actorId: memberId, action: "inscricao_cancelada_pelo_aluno", changes: { registrationId: r.id, cobrancaCancelada: r.asaasPaymentId ?? null } } });
  });
  // A vaga liberada vai para o primeiro da lista de espera.
  await processarListaDeEspera(r.eventId).catch(() => 0);
  atualizar(r.eventId);
  return { ok: true, mensagem: "Inscrição cancelada. A vaga foi liberada." };
}

export async function entrarNaListaDeEspera(memberId: string, eventId: string): Promise<Resultado> {
  const member = await requireAuthenticatedMember(memberId);
  const voluntario = await temAcessoVoluntario(member);
  const evento = await db.event.findFirst({
    where: { id: eventId, source: "manual", status: "publicado", startsAt: { gt: new Date() }, capacity: { not: null }, AND: [eventAudienceWhere(member, voluntario), eventScopeWhere(member.school)] },
  });
  if (!evento) return { ok: false, erro: "Este evento não aceita lista de espera." };
  if (evento.registrationClosesAt && evento.registrationClosesAt <= new Date()) return { ok: false, erro: "As inscrições deste evento foram encerradas." };
  if (await db.eventRegistration.findUnique({ where: { eventId_memberId: { eventId, memberId } } })) return { ok: false, erro: "Você já está inscrito neste evento." };
  await db.eventWaitlist.upsert({ where: { eventId_memberId: { eventId, memberId } }, create: { eventId, memberId }, update: {} });
  atualizar(eventId);
  return { ok: true, mensagem: "Você entrou na lista de espera. Avisaremos no celular se abrir uma vaga." };
}

export async function sairDaListaDeEspera(memberId: string, eventId: string): Promise<Resultado> {
  await requireAuthenticatedMember(memberId);
  await db.eventWaitlist.deleteMany({ where: { eventId, memberId } });
  await processarListaDeEspera(eventId).catch(() => 0);
  atualizar(eventId);
  return { ok: true, mensagem: "Você saiu da lista de espera." };
}
