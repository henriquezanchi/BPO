import {eventPosterUrl} from "@/lib/event-posters";
import {portalLabel} from "@/lib/display-labels";
import {eventAudienceWhere,safeEventRegistrationUrl} from "@/lib/event-policy";
import {ensureGroupMeetingWindow} from "@/lib/meeting-series";
import { BADGE_CATALOG, calcularStreakMeses, verificarEAtribuirConquistas } from "@/lib/badges";
import { ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { filiaisAdministradas, recursosDaFilial } from "@/lib/recursos-filial";
import { avaliacaoPendente } from "@/lib/avaliacao";
import { getAvatarUrl } from "@/lib/avatar-url";
import { db } from "@/lib/db";
import { avisosDosGrupos, meusGrupos } from "@/lib/grupos-dados";
import { gruposDaAgenda } from "@/lib/grupos-portal";
import { rubricaVisivelPara } from "@/lib/rubrica-visibilidade";
import type { ActivityType, Contribution, ContributionCompositionItem } from "@prisma/client";

/** Status que contam como "inadimplente" — usado tanto pra alertar a Economia quanto pro snapshot de PaymentCharge.memberWasOverdue. */
export const OVERDUE_STATUSES = new Set(["atrasado", "negociando"]);

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
export type SerializedCompositionItem = Omit<ContributionCompositionItem, "amount"> & { amount: number; pendingSync: boolean };

function serializeContribution(c: Contribution): SerializedContribution {
  return { ...c, amount: Number(c.amount) };
}

function serializeCompositionItem(c: ContributionCompositionItem, gruposComTarefaPendente: Set<string>): SerializedCompositionItem {
  return { ...c, amount: Number(c.amount), pendingSync: gruposComTarefaPendente.has(c.mercurioGroupId) };
}

export interface AgendaReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface PollOptionView {
  id: string;
  label: string;
  votes: number;
}

export type AgendaItem =
  | {kind:"reuniao";id:string;title:string;date:Date;endsAt:Date;className:string;description:string;fullUniform:boolean;status:string;cancellationReason:string|null;version:number;myResponse:string|null}
  | {
      kind: "evento";
      id: string;
      title: string;
      date: Date;
      price: number;
      reactions: AgendaReactionSummary[];
      // Inscrição do próprio membro (ver event-actions.ts) — null = ainda
      // não se inscreveu. Sempre null pra scope "nacional"/"regional" (não
      // têm fluxo de inscrição/pagamento ainda).
      minhaInscricao: { registrationId: string; pago: boolean; pixPayload: string | null; pixQrCodeBase64: string | null; refundState?: string; refundedAmount?: number } | null;
      posterUrl?: string | null;
      capacity?: number | null;
      availableSpots?: number | null;
      registrationClosed?: boolean;
      participantInstructions?: string | null;
      contactInfo?: string | null;
      paymentUnavailableReason?: string | null;
      source?: string;
      externalUid?: string | null;
      registrationUrl?: string | null;
      status?: string;
      scope: string; // "nacional" | "regional" | "filial"
      description: string | null;
      location: string | null;
      endsAt: Date | null;
      allDay: boolean;
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
      reactions: AgendaReactionSummary[];
    }
  | {
      kind: "enquete";
      id: string;
      question: string;
      date: Date; // createdAt da enquete — não tem uma "data" própria como evento/atividade
      className: string;
      options: PollOptionView[];
      myVote: string | null; // id da PollOption votada, null se ainda não votou
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
      // Situação mês a mês da contribuição (Ficha Anual do Mercúrio, ver
      // scripts/sync-monthly-status.ts), incluindo anos anteriores para
      // conferir a ordem dos pagamentos. Gateway confirmado prevalece
      // enquanto o sistema da escola ainda não atualiza.
      monthlyStatus: { orderBy: [{ year: "asc" }, { month: "asc" }] },
      paymentCharges: { where: { status: { in: ["pendente", "pago"] } }, select: { referenceYear: true, referenceMonth: true, status: true } },
      classMemberships: { include: { classGroup: true } },
    },
  });

  // Itens de composição com tarefa ainda pendente na fila (inclusão/edição
  // ainda não confirmada no Mercúrio pelo worker — ver process-mercurio-
  // queue.ts) — pra UI diferenciar visualmente "salvo, mas ainda não
  // confirmado" de "já confirmado".
  const tarefasComposicaoPendentes = await db.mercurioSyncTask.findMany({
    where: {
      memberId,
      status: "pendente",
      taskType: { in: ["incluir_item_composicao", "editar_valor_item_composicao"] },
    },
    select: { payload: true },
  });
  const gruposComTarefaPendente = new Set(
    tarefasComposicaoPendentes.map((t) => (t.payload as { mercurioGroupId: string }).mercurioGroupId),
  );

  // Catálogo sincronizado da filial (scripts/sync-composition.ts) menos o
  // que o membro já tem — não é mais lido ao vivo do Mercúrio a cada
  // carregamento do Portal (ver discussão de escala em CLAUDE.md/histórico).
  const gruposJaTidos = new Set(member.compositionItems.map((i) => i.mercurioGroupId));
  const availableToAdd = member.school.compositionCatalog
    .filter((c) => !gruposJaTidos.has(c.mercurioGroupId) && rubricaVisivelPara(c.label, member))
    .map((c) => ({ value: c.mercurioGroupId, label: c.label }));

  const walletAgg = await db.fortunaTransaction.aggregate({
    where: { memberId },
    _sum: { amount: true },
  });

  // Saldo real do Fortuna NÃO é buscado aqui — API externa (login+2
  // requests) segurava o carregamento inicial da tela inteira (bug real
  // relatado pelo usuário). FortunaWalletCard busca sozinho, client-side,
  // via getFortunaBalancesForMember — ver fortuna-member-actions.ts.
  const fortunaBalances: FortunaBalanceView[] = [];

  // Avisos de grupos de voluntários só com acesso liberado (ver acesso-voluntario.ts).
  const acessoVoluntario = await temAcessoVoluntario(member);
  const administradorNacional = await ehAdministradorNacional(member);
  // Recursos que a filial liberou (painéis ocultos por padrão) e se a pessoa administra alguma filial.
  const [recursos, administraFilial, avaliacao] = await Promise.all([
    recursosDaFilial(member.schoolId),
    filiaisAdministradas(member).then((f) => f.length > 0),
    // Quadrinho da avaliação de instrutores: só com rodada aberta e algo pendente pra este aluno.
    avaliacaoPendente(member),
  ]);
  const studentClassGroupIds = member.classMemberships
    .filter((cm) => cm.role === "aluno" && (cm.classGroup.tipo === "turma" || acessoVoluntario))
    .map((cm) => cm.classGroupId);

  const [schoolEvents, classActivities, classPolls] = await Promise.all([
    // Eventos da própria filial + nacionais/regionais (importados — ver
    // sync-national-calendar.ts). Pedido do usuário 2026-10-09: por ora
    // nacional/regional aparece pra TODO MUNDO, sem recorte por perfil
    // ainda (isso fica pra quando resolvermos o modelo de perfis/eventos).
    db.event.findMany({
      where: {
        OR: [{ schoolId: member.schoolId }, { scope: { in: ["nacional", "regional"] } }],
        AND: [eventAudienceWhere(member,acessoVoluntario),{OR:[{status:"publicado"},{status:"cancelado",registrations:{some:{memberId}}}]}],
        startsAt: { gte: new Date(Date.now()-86400000) },
      },
      orderBy: { startsAt: "asc" },
      include:{_count:{select:{registrations:true}}},
    }),
    studentClassGroupIds.length
      ? db.activity.findMany({
          where: { classGroupId: { in: studentClassGroupIds }, dueDate: { gte: new Date() } },
          include: { classGroup: true },
          orderBy: { dueDate: "asc" },
        })
      : Promise.resolve([]),
    studentClassGroupIds.length
      ? db.poll.findMany({
          where: { classGroupId: { in: studentClassGroupIds } },
          include: { classGroup: true, options: { include: { votes: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Reuniões dos grupos em que a pessoa é integrante: grupos de FV e secretarias com acesso de voluntário,
  // GAF sempre, GDVE só para FV (regras em grupos-portal.ts).
  const groupIds = await gruposDaAgenda({...member,classMemberships:member.classMemberships.filter(cm=>cm.role==='aluno'&&cm.classGroup.arquivadoEm===null)});
  const [avisosGrupos,meusGafs] = await Promise.all([avisosDosGrupos({...member,classMemberships:member.classMemberships.filter(cm=>cm.classGroup.arquivadoEm===null)}),meusGrupos(member,['GAF'])]);
  await ensureGroupMeetingWindow(groupIds);
  const meetings = groupIds.length ? await db.groupMeeting.findMany({
    where:{classGroupId:{in:groupIds},endsAt:{gte:new Date()}},orderBy:{startsAt:'asc'},
    select:{id:true,title:true,startsAt:true,endsAt:true,publicDetails:true,fullUniform:true,status:true,cancellationReason:true,version:true,classGroup:{select:{name:true}},responses:{where:{memberId},select:{response:true}}},
  }) : [];

  // Reações de emoji (ver toggleAgendaReaction) — 1 query só pros dois
  // tipos de item, agregada localmente em vez de N queries por card.
  const reacoesGravadas = await db.agendaReaction.findMany({
    where: {
      OR: [
        { itemType: "evento", itemId: { in: schoolEvents.map((e) => e.id) } },
        { itemType: "atividade", itemId: { in: classActivities.map((a) => a.id) } },
      ],
    },
  });

  // Inscrição do próprio membro nos eventos listados (ver event-actions.ts)
  // — pra decidir se mostra "Inscrever-se", o QR pendente, ou "Inscrito".
  const minhasInscricoes = await db.eventRegistration.findMany({
    where: { memberId, eventId: { in: schoolEvents.map((e) => e.id) } },
  });
  function inscricaoDoEvento(eventId: string): Extract<AgendaItem, { kind: "evento" }>["minhaInscricao"] {
    const r = minhasInscricoes.find((i) => i.eventId === eventId);
    if (!r) return null;
    return { registrationId: r.id, pago: r.paid, pixPayload: r.pixPayload, pixQrCodeBase64: r.pixQrCodeBase64, refundState:r.refundState, refundedAmount:Number(r.refundedAmount) };
  }

  function resumoReacoes(itemId: string): AgendaReactionSummary[] {
    const contagemPorEmoji = new Map<string, number>();
    const minhasReacoes = new Set<string>();
    for (const r of reacoesGravadas) {
      if (r.itemId !== itemId) continue;
      contagemPorEmoji.set(r.emoji, (contagemPorEmoji.get(r.emoji) ?? 0) + 1);
      if (r.memberId === memberId) minhasReacoes.add(r.emoji);
    }
    return [...contagemPorEmoji.entries()].map(([emoji, count]) => ({ emoji, count, reactedByMe: minhasReacoes.has(emoji) }));
  }

  const eventPosters=new Map(await Promise.all(schoolEvents.map(async e=>[e.id,await eventPosterUrl(e.posterPath)] as const)));
  const agendaItems: AgendaItem[] = [
    ...meetings.map((m):AgendaItem=>({kind:'reuniao',id:m.id,title:m.title,date:m.startsAt,endsAt:m.endsAt,className:portalLabel(m.classGroup.name),description:m.publicDetails,fullUniform:m.fullUniform,status:m.status,cancellationReason:m.cancellationReason,version:m.version,myResponse:m.responses[0]?.response??null})),
    ...schoolEvents.map(
      (e): AgendaItem => ({
        kind: "evento",
        id: e.id,
        title: e.title,
        date: e.startsAt,
        price: Number(e.price),
        reactions: resumoReacoes(e.id),
        minhaInscricao: inscricaoDoEvento(e.id),
        scope: e.scope,
        source: e.source,
        externalUid: e.externalUid,
        posterUrl:eventPosters.get(e.id)??e.imageUrl??null,
        capacity:e.capacity,
        availableSpots:e.capacity===null?null:Math.max(0,e.capacity-e._count.registrations),
        registrationClosed:Boolean(e.registrationClosesAt&&e.registrationClosesAt<=new Date()),
        participantInstructions:e.participantInstructions,
        contactInfo:e.contactInfo,
        paymentUnavailableReason: e.source!=="manual"||Number(e.price)<=0?null:!member.school.asaasWalletId?"O recebimento deste evento ainda precisa ser configurado pela escola.":!process.env.ASAAS_API_KEY?"O pagamento on-line ainda não foi configurado. A administração precisa configurar o Asaas antes de liberar o PIX.":null,
        registrationUrl: safeEventRegistrationUrl(e.registrationUrl),
        status: e.status,
        description: e.description,
        location: e.location,
        endsAt: e.endsAt,
        allDay: e.allDay,
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
        className: portalLabel(a.classGroup.name),
        reactions: resumoReacoes(a.id),
      }),
    ),
    ...classPolls.map(
      (p): AgendaItem => ({
        kind: "enquete",
        id: p.id,
        question: p.question,
        date: p.createdAt,
        className: portalLabel(p.classGroup.name),
        options: p.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes.length })),
        myVote: p.options.find((o) => o.votes.some((v) => v.memberId === memberId))?.id ?? null,
      }),
    ),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Best-effort — uma falha aqui não pode derrubar o carregamento do
  // Portal inteiro (ver decisão do usuário 2026-09-28 sobre conquistas).
  await verificarEAtribuirConquistas(memberId).catch(() => {});

  const [streakMeses, badges, levelHistory, integrationCourses, eventHistory] = await Promise.all([
    calcularStreakMeses(memberId),
    db.memberBadge.findMany({ where: { memberId }, orderBy: { earnedAt: "asc" } }),
    db.memberLevelHistory.findMany({ where: { memberId }, orderBy: { changedAt: "asc" } }),
    db.memberIntegrationCourse.findMany({ where: { memberId }, orderBy: { syncedAt: "asc" } }),
    db.eventRegistration.findMany({where:{memberId,checkedIn:true},select:{event:{select:{title:true,startsAt:true}}},orderBy:{event:{startsAt:"asc"}}}),
  ]);

  return {
    member: {
      ...member,
      contributions: member.contributions.map(serializeContribution),
      compositionItems: member.compositionItems.map((i) => serializeCompositionItem(i, gruposComTarefaPendente)),
      avatarUrl: getAvatarUrl(member.avatarPath),
    },
    acessoVoluntario,
    administradorNacional,
    recursos,
    administraFilial,
    avaliacao,
    walletBalance: Number(walletAgg._sum.amount ?? 0),
    fortunaBalances,
    agendaItems,
    avisosGrupos,
    meusGafs,
    availableToAdd,
    streakMeses,
    eventHistory: eventHistory.map(r=>({title:r.event.title,date:r.event.startsAt})),
    badges: badges.map((b) => ({ badgeType: b.badgeType, earnedAt: b.earnedAt, ...BADGE_CATALOG[b.badgeType] })),
    // O 1º registro de cada membro é só a linha de base de quando o sync
    // começou a observar o nível — não é uma mudança real (ver
    // sync-monthly-status.ts). Mostrar só o que veio depois.
    levelHistory: levelHistory.slice(1).map((l) => ({ nivel: l.nivel, changedAt: l.changedAt })),
    integrationCourses: integrationCourses.map((c) => ({
      courseName: c.courseName,
      instructor: c.instructor,
      date: c.courseDate ?? c.syncedAt,
    })),
  };
}

export type MemberDashboard = Awaited<ReturnType<typeof getMemberDashboard>>;
