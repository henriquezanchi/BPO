"use server";

import { asaasDeleteEventPayment, asaasGetPaymentStatus } from "@/lib/asaas/client";
import { contaDeLeituraId } from "@/lib/asaas/conta-escola";
import { requireAuthenticatedMember } from "@/lib/auth";
import { temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { eventAudienceWhere, eventScopeWhere, limiteDesistencia } from "@/lib/event-policy";
import { processEventRefund } from "@/lib/event-refunds";
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
 *  - já paga: dentro do prazo do evento (prazoDesistenciaDias, padrão 3 dias
 *    antes), a inscrição para de ocupar vaga e o reembolso é pedido ao Asaas
 *    pela mesma fila do cancelamento de evento (event-refunds.ts). Fora do
 *    prazo, ou em evento sem devolução, fica com a Economia.
 */
type Resultado = { ok: true; mensagem: string; desistenciaPaga?: boolean } | { ok: false; erro: string };

const dataCurta = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

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
  if (pagaDeVerdade) return desistirDePaga(memberId, r);
  if (["criando", "revisao"].includes(r.paymentState)) return { ok: false, erro: "Sua cobrança está em conferência pela Economia. Fale com a secretaria para desistir." };

  // PIX gerado: confere no Asaas antes de mexer — se já foi pago, a inscrição vale.
  if (r.asaasPaymentId && !r.paid) {
    try {
      const conta = await contaDeLeituraId(r.event.schoolId);
      const pagamento = await asaasGetPaymentStatus(r.asaasPaymentId, conta);
      if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(pagamento.status)) {
        await confirmEventPayment(r.id);
        atualizar(r.eventId);
        return { ok: false, erro: "O pagamento desta inscrição já tinha sido recebido, então ela está confirmada. Se ainda quiser desistir, toque de novo em cancelar." };
      }
      const removida = await asaasDeleteEventPayment(r.asaasPaymentId, conta);
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

async function desistirDePaga(memberId: string, r: { id: string; eventId: string; desistenciaEm: Date | null; event: { startsAt: Date; prazoDesistenciaDias: number | null } }): Promise<Resultado> {
  if (r.desistenciaEm) return { ok: false, erro: "Sua desistência já foi registrada; a devolução está em andamento." };
  const limite = limiteDesistencia(r.event.startsAt, r.event.prazoDesistenciaDias);
  if (!limite) return { ok: false, erro: "Este evento não prevê devolução em caso de desistência. Fale com a Economia da filial." };
  if (new Date() > limite) return { ok: false, erro: `O prazo para desistir com devolução terminou em ${dataCurta(limite)}. Fale com a Economia da filial.` };

  const registrada = await db.$transaction(async (tx) => {
    const marcado = await tx.eventRegistration.updateMany({
      where: { id: r.id, memberId, desistenciaEm: null, refundState: "nao_solicitado", paid: true },
      data: { desistenciaEm: new Date(), refundState: "pendente", refundNextAttemptAt: new Date() },
    });
    if (!marcado.count) return false;
    await tx.eventNotice.updateMany({ where: { registrationId: r.id, status: "aguardando_canal" }, data: { status: "cancelado" } });
    await tx.eventAudit.create({ data: { eventId: r.eventId, actorId: memberId, action: "desistencia_com_reembolso", changes: { registrationId: r.id } } });
    return true;
  });
  if (!registrada) return { ok: false, erro: "Não foi possível registrar a desistência agora. Atualize a página e tente de novo." };
  // Pede o reembolso já; se o Asaas falhar, a fila de reembolsos tenta de novo sozinha.
  await processEventRefund(r.id).catch(() => null);
  await processarListaDeEspera(r.eventId).catch(() => 0);
  atualizar(r.eventId);
  return { ok: true, desistenciaPaga: true, mensagem: "Desistência registrada. A devolução do valor foi pedida e aparece aqui quando concluída." };
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
