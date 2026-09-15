import { db } from "@/lib/db";
import type { ActivityType, Contribution, ContributionCompositionItem, ContributionReceipt } from "@prisma/client";
import { fortunaGetBranches, fortunaGetClient } from "@/lib/fortuna/client";

export interface FortunaBalanceView {
  branchId: number;
  branchTitle: string;
  amount: number;
  isHome: boolean;
}

// Server Components só podem passar objetos "planos" para Client Components
// — instâncias de Decimal (retornadas pelo Prisma para campos @db.Decimal)
// não são suportadas e quebram a serialização. Convertemos para number aqui,
// na borda dos dados, em vez de em cada componente que consome Contribution.
export type SerializedContribution = Omit<Contribution, "amount"> & { amount: number };
export type SerializedCompositionItem = Omit<ContributionCompositionItem, "amount"> & { amount: number };
export type SerializedReceipt = Omit<ContributionReceipt, "amount" | "rawText"> & { amount: number };

function serializeContribution(c: Contribution): SerializedContribution {
  return { ...c, amount: Number(c.amount) };
}

function serializeCompositionItem(c: ContributionCompositionItem): SerializedCompositionItem {
  return { ...c, amount: Number(c.amount) };
}

// rawText nunca vai pro client já na carga inicial do dashboard — só é
// buscado/exposto quando o membro pede explicitamente pra ver um recibo
// específico (ver viewReceipt em receipt-actions.ts).
function serializeReceipt(r: ContributionReceipt): SerializedReceipt {
  return {
    id: r.id,
    memberId: r.memberId,
    mercurioRecId: r.mercurioRecId,
    issuedAt: r.issuedAt,
    amount: Number(r.amount),
    itemsSummary: r.itemsSummary,
    probablyCanceled: r.probablyCanceled,
    canceled: r.canceled,
    fetchedAt: r.fetchedAt,
    createdAt: r.createdAt,
  };
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
      school: { include: { compositionCatalog: true } },
      contributions: { orderBy: { dueDate: "desc" }, take: 6 },
      compositionItems: { orderBy: { createdAt: "asc" } },
      // canceled === true fica de fora — recibo cancelado não é um
      // comprovante válido. canceled === null (ainda não confirmado, ver
      // ContributionReceipt) continua aparecendo, só é confirmado quando o
      // membro pede pra ver/baixar (viewReceipt). Importante: filtrar com
      // `canceled: { not: true }` direto NÃO funciona pra null — o SQL
      // gerado exclui as linhas null também (lógica de 3 valores),
      // confirmado ao vivo — por isso o OR explícito abaixo.
      receipts: {
        where: { OR: [{ canceled: null }, { canceled: false }] },
        orderBy: { issuedAt: "desc" },
        take: 5,
      },
      // Situação mês a mês da contribuição (Ficha Anual do Mercúrio, ver
      // scripts/sync-monthly-status.ts) do ano corrente — alimenta a tela
      // "situação atual" do ambiente de pagamento (cobrança/lançamento
      // ainda não implementados).
      monthlyStatus: { where: { year: new Date().getFullYear() }, orderBy: { month: "asc" } },
      classMemberships: { include: { classGroup: true } },
    },
  });

  // Catálogo sincronizado da filial (scripts/sync-composition.ts) menos o
  // que o membro já tem — não é mais lido ao vivo do Mercúrio a cada
  // carregamento do Portal (ver discussão de escala em CLAUDE.md/histórico).
  const gruposJaTidos = new Set(member.compositionItems.map((i) => i.mercurioGroupId));
  const availableToAdd = member.school.compositionCatalog
    .filter((c) => !gruposJaTidos.has(c.mercurioGroupId))
    .map((c) => ({ value: c.mercurioGroupId, label: c.label }));

  const walletAgg = await db.fortunaTransaction.aggregate({
    where: { memberId },
    _sum: { amount: true },
  });

  // Saldo real do Fortuna (carteira digital da lanchonete) — lido AO VIVO
  // a cada carregamento, diferente do Mercúrio: é uma API REST normal,
  // rápida, sem trava de sessão única, então não precisa de sync/cache.
  // Sem fortunaClientId ainda (membro não vinculado — ver
  // scripts/link-fortuna-clients.ts) ou API fora do ar: fica lista vazia,
  // não quebra o resto do dashboard.
  let fortunaBalances: FortunaBalanceView[] = [];
  if (member.fortunaClientId) {
    try {
      const [client, branches] = await Promise.all([fortunaGetClient(member.fortunaClientId), fortunaGetBranches()]);
      const tituloPorFilial = new Map(branches.map((b) => [b.id, b.title]));
      fortunaBalances = client.balance.map((b) => ({
        branchId: b.branchId,
        branchTitle: tituloPorFilial.get(b.branchId) ?? `Filial ${b.branchId}`,
        amount: Number(b.amount),
        isHome: b.branchId === client.branch.id,
      }));
    } catch (e) {
      console.error("Falha ao buscar saldo Fortuna:", (e as Error).message);
    }
  }

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
      receipts: member.receipts.map(serializeReceipt),
    },
    walletBalance: Number(walletAgg._sum.amount ?? 0),
    fortunaBalances,
    agendaItems,
    isTeacher,
    availableToAdd,
  };
}

export type MemberDashboard = Awaited<ReturnType<typeof getMemberDashboard>>;
