"use server";

import { requireAuthenticatedMember, requireTeacherOfClass } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface CreatePollInput {
  classGroupId: string;
  question: string;
  options: string[];
}

/** Professor cria uma enquete pra turma — aparece pros alunos em "Agenda & Eventos", igual atividade. */
export async function createPoll(input: CreatePollInput) {
  const professor = await requireTeacherOfClass(input.classGroupId);

  const opcoesValidas = input.options.map((o) => o.trim()).filter(Boolean);
  if (!input.question.trim()) throw new Error("A enquete precisa de uma pergunta.");
  if (opcoesValidas.length < 2) throw new Error("A enquete precisa de pelo menos 2 opções.");

  const poll = await db.poll.create({
    data: {
      classGroupId: input.classGroupId,
      createdById: professor.id,
      question: input.question.trim(),
      options: { create: opcoesValidas.map((label) => ({ label })) },
    },
  });

  revalidatePath("/portal");
  revalidatePath(`/professor/turma/${input.classGroupId}`);
  return poll;
}

/**
 * Aluno vota (ou troca o voto) numa enquete da turma — 1 voto por membro
 * por enquete (ver @@unique em PollVote), confirmado aqui de novo mesmo
 * com a constraint no banco, pra devolver o resultado atualizado direto
 * (evita um round-trip extra só pra reler as contagens).
 */
export async function votePoll(memberId: string, pollId: string, pollOptionId: string) {
  const member = await requireAuthenticatedMember(memberId);

  const poll = await db.poll.findUniqueOrThrow({ where: { id: pollId } });
  const matricula = await db.classMembership.findFirst({
    where: { classGroupId: poll.classGroupId, memberId: member.id, role: "aluno" },
  });
  if (!matricula) throw new Error("Você não é aluno desta turma.");

  await db.pollVote.upsert({
    where: { pollId_memberId: { pollId, memberId: member.id } },
    update: { pollOptionId },
    create: { pollId, pollOptionId, memberId: member.id },
  });

  const contagens = await db.pollVote.groupBy({
    by: ["pollOptionId"],
    where: { pollId },
    _count: { pollOptionId: true },
  });

  revalidatePath("/portal");

  return {
    myOptionId: pollOptionId,
    counts: Object.fromEntries(contagens.map((c) => [c.pollOptionId, c._count.pollOptionId])) as Record<string, number>,
  };
}
