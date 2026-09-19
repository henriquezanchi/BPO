"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioEconomicNotesUpdate } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

/**
 * Detalhe completo de 1 membro pro drawer do Painel do Diretor — contato,
 * composição, grade de status mensal (mesmo padrão de member-data.ts,
 * filtrado no ano corrente) e a negociação aberta (CrmContact sem
 * resolvedAt), se houver.
 */
export async function getMemberDetail(schoolId: string, memberId: string) {
  await requireDirector(schoolId);

  const member = await db.member.findUniqueOrThrow({
    where: { id: memberId },
    include: {
      compositionItems: true,
      monthlyStatus: { where: { year: new Date().getFullYear() }, orderBy: { month: "asc" } },
      crmContacts: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (member.schoolId !== schoolId) throw new Error("Membro não pertence a esta escola.");

  return {
    id: member.id,
    name: member.name,
    registrationNo: member.registrationNo,
    whatsapp: member.whatsapp,
    email: member.email,
    status: member.status,
    economicNotes: member.economicNotes,
    compositionItems: member.compositionItems.map((i) => ({ id: i.id, label: i.label, amount: Number(i.amount) })),
    monthlyStatus: member.monthlyStatus.map((s) => ({ month: s.month, status: s.status })),
    negociacaoAberta: member.crmContacts[0]
      ? { id: member.crmContacts[0].id, notes: member.crmContacts[0].notes, promisedPaymentDate: member.crmContacts[0].promisedPaymentDate }
      : null,
  };
}

/**
 * Igual ao padrão de updateMemberContact/updatePersonalData: escreve local
 * na hora, só enfileira a propagação pro Mercúrio — worker separado
 * (scripts/process-mercurio-queue.ts) processa em background.
 */
export async function updateMemberEconomicNotes(schoolId: string, memberId: string, texto: string) {
  await requireDirector(schoolId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.schoolId !== schoolId) throw new Error("Membro não pertence a esta escola.");

  const textoLimitado = texto.slice(0, 255);
  await db.member.update({ where: { id: memberId }, data: { economicNotes: textoLimitado } });
  await enqueueMercurioEconomicNotesUpdate(memberId, textoLimitado);

  revalidatePath("/diretor");
}
