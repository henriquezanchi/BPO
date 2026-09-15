import { db } from "@/lib/db";
import type { ActivityType, Contribution, ContributionCompositionItem } from "@prisma/client";

// Server Components só podem passar objetos "planos" para Client Components
// — instâncias de Decimal (retornadas pelo Prisma para campos @db.Decimal)
// não são suportadas e quebram a serialização. Convertemos para number aqui,
// na borda dos dados, em vez de em cada componente que consome Contribution.
export type SerializedContribution = Omit<Contribution, "amount"> & { amount: number };
export type SerializedCompositionItem = Omit<ContributionCompositionItem, "amount"> & { amount: number };

function serializeContribution(c: Contribution): SerializedContribution {
  return { ...c, amount: Number(c.amount) };
}

function serializeCompositionItem(c: ContributionCompositionItem): SerializedCompositionItem {
  return { ...c, amount: Number(c.amount) };
}

export type AgendaItem =
  | {
      kind: "evento";
      id: string;
      title: string;
      date: Date;
      price: number;
    }
  | {
      kind: "atividade";
      id: string;
      title: string;
      date: Date;
      type: ActivityType;
      studyItems: string | null;
      description: string | null;
      className: string;
    };

/**
 * Dados para o Portal do Membro: cadastro, contribuições recentes, saldo
 * Fortuna e a agenda unificada (eventos da escola + atividades das turmas
 * em que o membro está matriculado como aluno).
 */
export async function getMemberDashboard(memberId: string) {
  const member = await db.member.findUniqueOrThrow({
    where: { id: memberId },
    include: {
      school: true,
      contributions: { orderBy: { dueDate: "desc" }, take: 6 },
      compositionItems: { orderBy: { createdAt: "asc" } },
      classMemberships: { include: { classGroup: true } },
    },
  });

  const walletAgg = await db.fortunaTransaction.aggregate({
    where: { memberId },
    _sum: { amount: true },
  });

  const studentClassGroupIds = member.classMemberships
    .filter((cm) => cm.role === "aluno")
    .map((cm) => cm.classGroupId);

  const [schoolEvents, classActivities] = await Promise.all([
    db.event.findMany({
      where: { schoolId: member.schoolId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    }),
    studentClassGroupIds.length
      ? db.activity.findMany({
          where: { classGroupId: { in: studentClassGroupIds }, dueDate: { gte: new Date() } },
          include: { classGroup: true },
          orderBy: { dueDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const agendaItems: AgendaItem[] = [
    ...schoolEvents.map(
      (e): AgendaItem => ({
        kind: "evento",
        id: e.id,
        title: e.title,
        date: e.startsAt,
        price: Number(e.price),
      }),
    ),
    ...classActivities.map(
      (a): AgendaItem => ({
        kind: "atividade",
        id: a.id,
        title: a.title,
        date: a.dueDate,
        type: a.type,
        studyItems: a.studyItems,
        description: a.description,
        className: a.classGroup.name,
      }),
    ),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const isTeacher = member.classMemberships.some((cm) => cm.role === "professor");

  return {
    member: {
      ...member,
      contributions: member.contributions.map(serializeContribution),
      compositionItems: member.compositionItems.map(serializeCompositionItem),
    },
    walletBalance: Number(walletAgg._sum.amount ?? 0),
    agendaItems,
    isTeacher,
  };
}

export type MemberDashboard = Awaited<ReturnType<typeof getMemberDashboard>>;
