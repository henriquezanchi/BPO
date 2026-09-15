"use server";

import { requireTeacherOfClass } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { revalidatePath } from "next/cache";
import type { ActivityType } from "@prisma/client";

export interface CreateActivityInput {
  classGroupId: string;
  type: ActivityType;
  title: string;
  studyItems?: string;
  description?: string;
  dueDate: Date;
}

/**
 * Professor cadastra uma atividade (prova, trabalho, leitura...) para a
 * turma. Todos os alunos matriculados na turma passam a ver a atividade em
 * "Agenda & Eventos" no Portal do Membro automaticamente — não é uma seção
 * nova, é a mesma agenda que já lista os eventos da escola.
 *
 * O aviso por WhatsApp é disparado na hora; um push nativo (PWA) fica como
 * evolução futura quando tivermos esse canal.
 */
export async function createActivity(input: CreateActivityInput) {
  const professor = await requireTeacherOfClass(input.classGroupId);

  const activity = await db.activity.create({
    data: {
      classGroupId: input.classGroupId,
      createdById: professor.id,
      type: input.type,
      title: input.title,
      studyItems: input.studyItems,
      description: input.description,
      dueDate: input.dueDate,
    },
  });

  const roster = await db.classMembership.findMany({
    where: { classGroupId: input.classGroupId, role: "aluno" },
    include: { member: true },
  });

  await db.activityNotification.createMany({
    data: roster.map((r) => ({
      activityId: activity.id,
      memberId: r.memberId,
      channel: "whatsapp" as const,
    })),
  });

  const dueDateLabel = input.dueDate.toLocaleDateString("pt-BR");
  const message = `Nova atividade da turma: *${input.title}* (${dueDateLabel}).${
    input.studyItems ? `\nConteúdo: ${input.studyItems}` : ""
  }\nConfira em Agenda & Eventos no Portal do Membro.`;

  await Promise.all(
    roster.map(async (r) => {
      const result = await sendWhatsAppMessage(r.member.whatsapp, message);
      await db.activityNotification.updateMany({
        where: { activityId: activity.id, memberId: r.memberId },
        data: result.ok
          ? { status: "enviado", sentAt: new Date() }
          : { status: "falhou" },
      });
    }),
  );

  revalidatePath("/portal");

  return activity;
}
