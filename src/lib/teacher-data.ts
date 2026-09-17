import { requireTeacherOfClass } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getTeacherClasses(memberId: string) {
  const memberships = await db.classMembership.findMany({
    where: { memberId, role: "professor" },
    include: {
      classGroup: {
        include: {
          _count: { select: { memberships: { where: { role: "aluno" } } } },
          activities: { orderBy: { dueDate: "desc" }, take: 5 },
        },
      },
    },
  });

  return memberships.map((m) => m.classGroup);
}

export type TeacherClass = Awaited<ReturnType<typeof getTeacherClasses>>[number];

/**
 * Detalhe de 1 turma pro professor: alunos matriculados, atividades e
 * enquetes com o resultado (contagem de votos por opção) — confirma que
 * quem está logado de fato dá aula ali antes de devolver qualquer coisa
 * (mesma checagem de createActivity/createPoll).
 */
export async function getTeacherClassDetail(classGroupId: string) {
  await requireTeacherOfClass(classGroupId);

  const classGroup = await db.classGroup.findUniqueOrThrow({
    where: { id: classGroupId },
    include: {
      memberships: { where: { role: "aluno" }, include: { member: true }, orderBy: { member: { name: "asc" } } },
      activities: { orderBy: { dueDate: "desc" } },
      polls: { orderBy: { createdAt: "desc" }, include: { options: { include: { _count: { select: { votes: true } } } } } },
    },
  });

  return {
    id: classGroup.id,
    name: classGroup.name,
    students: classGroup.memberships.map((m) => ({ id: m.member.id, name: m.member.name, registrationNo: m.member.registrationNo })),
    activities: classGroup.activities,
    polls: classGroup.polls.map((p) => ({
      id: p.id,
      question: p.question,
      createdAt: p.createdAt,
      options: p.options.map((o) => ({ id: o.id, label: o.label, votes: o._count.votes })),
    })),
  };
}

export type TeacherClassDetail = Awaited<ReturnType<typeof getTeacherClassDetail>>;
