import { db } from "@/lib/db";
import { portalLabel } from "@/lib/display-labels";
import { ensureGroupMeetingWindow } from "@/lib/meeting-series";
import type { AgendaItem } from "@/lib/member-data";

/**
 * Programação da turma para o instrutor (pedido do usuário 17/11/2026): aulas/encontros da turma e as atividades
 * publicadas (provas, trabalhos, leituras), do mês corrente até 3 meses à frente, no mesmo formato da Agenda — a arte e
 * o texto saem de lib/programacao-mes.ts. Quem chama já conferiu que a pessoa é responsável pela turma.
 */
export async function agendaDaTurma(classGroupId: string): Promise<AgendaItem[]> {
  const agora = new Date();
  const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1) - 864e5);
  const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 4, 1));
  await ensureGroupMeetingWindow([classGroupId]).catch(() => {});
  const [reunioes, atividades] = await Promise.all([
    db.groupMeeting.findMany({
      where: { classGroupId, startsAt: { gte: inicio, lt: fim } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true, endsAt: true, publicDetails: true, status: true, cancellationReason: true, version: true, classGroup: { select: { name: true } } },
    }),
    db.activity.findMany({ where: { classGroupId, dueDate: { gte: inicio, lt: fim } }, include: { classGroup: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
  ]);
  return [
    ...reunioes.map((m): AgendaItem => ({ kind: "reuniao", id: m.id, title: m.title, date: m.startsAt, endsAt: m.endsAt, className: portalLabel(m.classGroup.name), description: m.publicDetails, fullUniform: false, status: m.status, cancellationReason: m.cancellationReason, version: m.version, myResponse: null })),
    ...atividades.map((a): AgendaItem => ({
      kind: "atividade",
      id: a.id,
      title: a.title,
      date: a.dueDate,
      type: a.type,
      materiaNome: a.materiaNome,
      temas: a.temas,
      observacao: a.observacaoAlunos,
      resumos: [],
      studyItems: a.studyItems,
      description: a.description,
      className: portalLabel(a.classGroup.name),
      reactions: [],
    })),
  ];
}
