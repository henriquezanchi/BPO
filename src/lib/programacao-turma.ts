import { db } from "@/lib/db";
import { portalLabel } from "@/lib/display-labels";
import { ensureGroupMeetingWindow } from "@/lib/meeting-series";
import { apresentacoesPorEncontro } from "@/lib/escala-pedagogos";
import { localInZone } from "@/lib/group-meetings";
import { leiturasDosEncontrosGaf } from "@/lib/leituras-encontros";
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
      select: { id: true, title: true, startsAt: true, endsAt: true, publicDetails: true, status: true, cancellationReason: true, version: true, classGroup: { select: { name: true, tipo: true } }, timeZone: true },
    }),
    db.activity.findMany({ where: { classGroupId, dueDate: { gte: inicio, lt: fim } }, include: { classGroup: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
  ]);
  // Turma de pedagogos: quem apresenta e o tema em cada encontro; GAF: a leitura (24/11/2026). Inclui os encontros
  // do mês já passados, para a programação do mês inteiro.
  const tipo = reunioes[0]?.classGroup.tipo;
  const apresentacoes = tipo === "PED" ? await apresentacoesPorEncontro([classGroupId], inicio.toISOString().slice(0, 10)) : new Map<string, string[]>();
  const leituras = tipo === "GAF" ? await leiturasDosEncontrosGaf([classGroupId]) : new Map<string, string>();
  return [
    ...reunioes.map((m): AgendaItem => ({ kind: "reuniao", id: m.id, title: m.title, date: m.startsAt, endsAt: m.endsAt, className: portalLabel(m.classGroup.name), description: m.publicDetails, fullUniform: false, status: m.status, cancellationReason: m.cancellationReason, version: m.version, myResponse: null, apresentacoes: apresentacoes.get(`${classGroupId}:${localInZone(m.startsAt, m.timeZone || "America/Sao_Paulo").slice(0, 10)}`), leitura: leituras.get(m.id) })),
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
