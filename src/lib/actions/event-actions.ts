"use server";

import { asaasCreatePixCharge, asaasFindOrCreateCustomer, asaasGetPaymentStatus, asaasGetPixQrCode } from "@/lib/asaas/client";
import { calcularSplitEscola } from "@/lib/asaas/split";
import { requireAuthenticatedMember, requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Gestão de Eventos ainda não tinha como criar um evento pela UI — a aba
 * só mostrava dados que já existissem no banco (achado ao vivo 2026-09-30
 * ao construir a inscrição pelo Portal: não tinha como ter um evento real
 * pra se inscrever). Preço 0 = entrada gratuita.
 */
export async function criarEvento(schoolId: string, title: string, startsAt: string, price: number) {
  await requireDirector(schoolId);
  if (!title.trim()) throw new Error("Título não pode ser vazio.");
  if (price < 0) throw new Error("Preço não pode ser negativo.");
  await db.event.create({ data: { schoolId, title: title.trim(), startsAt: new Date(startsAt), price } });
  revalidatePath("/diretor");
}

export async function excluirEvento(schoolId: string, eventId: string) {
  await requireDirector(schoolId);
  const evento = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  if (evento.schoolId !== schoolId) throw new Error("Evento não pertence a esta escola.");
  await db.event.delete({ where: { id: eventId } });
  revalidatePath("/diretor");
}

/** Chamado ao check-in na portaria (ver EventosTab). */
export async function marcarPresencaEvento(schoolId: string, registrationId: string, presente: boolean) {
  await requireDirector(schoolId);
  const registro = await db.eventRegistration.findUniqueOrThrow({ where: { id: registrationId }, include: { event: true } });
  if (registro.event.schoolId !== schoolId) throw new Error("Inscrição não pertence a esta escola.");
  await db.eventRegistration.update({ where: { id: registrationId }, data: { checkedIn: presente } });
  revalidatePath("/diretor");
}

/**
 * Inscrição em evento pelo Portal — decisão do usuário 2026-09-30. Evento
 * gratuito: registra na hora, nada a cobrar. Evento pago: mesmo fluxo de
 * cobrança PIX já usado pra contribuição (split 98/2 com a escola), a
 * confirmação acontece por polling (ver checkStatusInscricaoEvento),
 * igual ao padrão já usado pra recarga Fortuna dedicada.
 */
export async function inscreverEmEvento(memberId: string, eventId: string, cpf?: string) {
  const member = await requireAuthenticatedMember(memberId);
  const evento = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  if (evento.schoolId !== member.schoolId) throw new Error("Evento não pertence à sua escola.");

  const existente = await db.eventRegistration.findUnique({ where: { eventId_memberId: { eventId, memberId } } });
  if (existente) {
    if (existente.paid) return { jaInscrito: true as const, pago: true as const };
    if (existente.pixPayload) {
      return {
        jaInscrito: true as const,
        pago: false as const,
        registrationId: existente.id,
        pixPayload: existente.pixPayload,
        pixQrCodeBase64: existente.pixQrCodeBase64!,
      };
    }
  }

  const valor = Number(evento.price);
  if (valor <= 0) {
    const registro = existente
      ? await db.eventRegistration.update({ where: { id: existente.id }, data: { paid: true, paidAt: new Date() } })
      : await db.eventRegistration.create({ data: { eventId, memberId, paid: true, paidAt: new Date() } });
    return { jaInscrito: true as const, pago: true as const, registrationId: registro.id };
  }

  if (!cpf) throw new Error("CPF é obrigatório pra inscrição em evento pago.");
  const cliente = await asaasFindOrCreateCustomer(member.name, cpf, member.email ?? undefined);

  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 2);
  const dueDate = vencimento.toISOString().slice(0, 10);

  const school = await db.school.findUniqueOrThrow({ where: { id: member.schoolId } });
  const split = school.asaasWalletId ? [await calcularSplitEscola(valor, school.asaasWalletId)] : undefined;
  const pagamento = await asaasCreatePixCharge(cliente.id, valor, `Inscrição: ${evento.title} — ${member.name}`, dueDate, split);
  const qrcode = await asaasGetPixQrCode(pagamento.id);

  const registro = existente
    ? await db.eventRegistration.update({
        where: { id: existente.id },
        data: { asaasCustomerId: cliente.id, asaasPaymentId: pagamento.id, pixPayload: qrcode.payload, pixQrCodeBase64: qrcode.encodedImage },
      })
    : await db.eventRegistration.create({
        data: {
          eventId,
          memberId,
          asaasCustomerId: cliente.id,
          asaasPaymentId: pagamento.id,
          pixPayload: qrcode.payload,
          pixQrCodeBase64: qrcode.encodedImage,
        },
      });

  return { jaInscrito: false as const, pago: false as const, registrationId: registro.id, pixPayload: qrcode.payload, pixQrCodeBase64: qrcode.encodedImage };
}

/** Confere o status real no Asaas (fallback do webhook, mesmo padrão de checkChargeStatus/checkFortunaTopUpStatus). */
export async function checkStatusInscricaoEvento(memberId: string, registrationId: string) {
  await requireAuthenticatedMember(memberId);
  const registro = await db.eventRegistration.findUniqueOrThrow({ where: { id: registrationId } });
  if (registro.memberId !== memberId) throw new Error("Inscrição não pertence a este membro.");
  if (registro.paid) return { status: "pago" as const };
  if (!registro.asaasPaymentId) return { status: "pendente" as const };

  const pagamento = await asaasGetPaymentStatus(registro.asaasPaymentId);
  if (pagamento.status !== "RECEIVED" && pagamento.status !== "CONFIRMED") return { status: "pendente" as const };

  await db.eventRegistration.update({ where: { id: registrationId }, data: { paid: true, paidAt: new Date() } });
  return { status: "pago" as const };
}
