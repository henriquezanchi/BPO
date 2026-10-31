import {comAcessoVoluntario} from "@/lib/acesso-voluntario";
import { contarInscritosUlisses } from "@/lib/ulisses/inscritos";
import {eventPosterUrl} from "@/lib/event-posters";
import { getAvatarUrl } from "@/lib/avatar-url";
import { db } from "@/lib/db";
import { fusoDaEscola, mesNoFuso } from "@/lib/fuso-escola";
import { custosDoMes, whatsappFinanceiroAtivo } from "@/lib/whatsapp/financeiro";

export interface MemberRow {
  id: string;
  name: string;
  registrationNo: string | null;
  whatsapp: string;
  status: string;
  mercurioAtivo: boolean;
  compositionLabels: string[];
  compositionTotal: number;
  overdueCount: number;
  avatarUrl: string | null;
}

export interface TransacaoRecente {
  id: string;
  memberName: string;
  amount: number;
  paidAt: Date;
  tipo: "contribuicao" | "recarga_fortuna";
}

/**
 * Dados reais pro Painel do Diretor. Onde ainda não existe fonte real
 * (régua de cobrança em execução, antecipação/factoring, portaria de
 * eventos, malote contábil), a tela mostra a lista real (mesmo vazia) em
 * vez de inventar número — ver conversa: "sem fingir funcionalidade que
 * não existe".
 */
export async function getDirectorDashboard(schoolId: string) {
  // Desempenho (31/10/2026): as consultas independentes rodam juntas (antes eram ~18 em série). O mês corrente é o da
  // filial: com o relógio do servidor (UTC), o que entrava entre 21h e meia-noite do último dia ia para o mês seguinte.
  const [membros, escola] = await Promise.all([
    db.member.findMany({
      where: { schoolId },
      include: { compositionItems: true },
      orderBy: { name: "asc" },
    }),
    db.school.findUnique({ where: { id: schoolId }, select: { uf: true, asaasSubaccountApiKey: true } }),
  ]);
  const mesAtual = mesNoFuso(fusoDaEscola(escola?.uf));
  // Instantes (pagamentos, eventos) usam a meia-noite da filial; vencimentos são datas civis gravadas à meia-noite UTC.
  const { inicio: inicioMes, fim: fimMes, inicioCivil, fimCivil } = mesAtual;

  const ativos = membros.filter((m) => m.mercurioAtivo);
  const atrasados = ativos.filter((m) => m.status === "atrasado");

  const totalComposicao = (m: (typeof membros)[number]) => m.compositionItems.reduce((soma, i) => soma + Number(i.amount), 0);

  const receitaPrevista = ativos.reduce((soma, m) => soma + totalComposicao(m), 0);
  const totalEmAtraso = atrasados.reduce((soma, m) => soma + totalComposicao(m), 0);
  const taxaInadimplencia = ativos.length > 0 ? (atrasados.length / ativos.length) * 100 : 0;
  const activeMembers = ativos;

  const [
    atrasosPorMembro,
    despesasPendentes,
    despesasRealizadas,
    rubricasDisponiveis,
    contasReais,
    contasReaisConciliadas,
    despesasRealizadasMesAgg,
    eventosMes,
    fortunaTxRecentes,
    recargasFortunaPendentesDedicadas,
    recargasFortunaPendentesCombinadas,
    cobrancasPagas,
    recargasFortunaPagas,
    [volunteerAccess, nationalAccess],
    eventos,
    regrasDeCobranca,
    rascunhosPendentes,
    negociacoesAbertas,
    custosWhatsapp,
  ] = await Promise.all([
    db.contributionMonthlyStatus.groupBy({
      by: ["memberId"],
      where: { member: { schoolId }, status: "atrasado" },
      _count: { _all: true },
    }),
    db.payable.findMany({
      where: { schoolId, paidAt: null },
      include: { documents: true, rubrica: true },
      orderBy: { dueDate: "asc" },
    }),
    // take maior que antes (era 20) — agora agrupado por mês em gavetas
    // colapsáveis na UI, então precisa de histórico suficiente pra mostrar
    // mais de 1-2 meses fechados antes do atual.
    db.payable.findMany({
      where: { schoolId, paidAt: { not: null } },
      include: { documents: true, rubrica: true },
      orderBy: { paidAt: "desc" },
      take: 200,
    }),
    db.schoolPaymentRubrica.findMany({ where: { schoolId }, orderBy: { label: "asc" } }),
    // % conciliado (medidor) — só considera contas REAIS (não previsão
    // automática ainda não confirmada) que já deveriam ter documento: uma
    // conta "conciliada" é a que tem pelo menos 1 recibo/NF anexado. Duas contagens (antes vinham todas as contas).
    db.payable.count({ where: { schoolId, predicted: false } }),
    db.payable.count({ where: { schoolId, predicted: false, documents: { some: {} } } }),
    db.payable.aggregate({
      where: { schoolId, paidAt: { gte: inicioMes, lt: fimMes } },
      _sum: { amount: true },
    }),
    db.event.findMany({
      where: { schoolId, status: "publicado", startsAt: { gte: inicioMes, lt: fimMes } },
      select: { price: true, _count: { select: { registrations: { where: { desistenciaEm: null } } } } },
    }),
    db.fortunaTransaction.findMany({
      where: { member: { schoolId } },
      select: { amount: true, member: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // Recargas pagas via PIX cujo crédito AUTOMÁTICO no Fortuna falhou (ver
    // checkFortunaTopUpStatus) — fila de exceção pra lançamento manual, não o
    // caminho normal (que já credita sozinho assim que o PIX é confirmado).
    // Duas origens possíveis desde 2026-09-22: recarga dedicada
    // (FortunaTopUpCharge) e recarga combinada com a contribuição
    // (PaymentCharge.fortunaTopUpAmount, ver payment-actions.ts) — mescladas
    // aqui numa lista só, com `source` pra UI saber qual action chamar.
    db.fortunaTopUpCharge.findMany({
      where: { member: { schoolId }, status: "pago", launchedAt: null },
      include: { member: { select: { name: true } } },
      orderBy: { paidAt: "asc" },
    }),
    db.paymentCharge.findMany({
      where: { member: { schoolId }, status: "pago", fortunaTopUpAmount: { not: null }, fortunaTopUpLaunchedAt: null },
      include: { member: { select: { name: true } } },
      orderBy: { paidAt: "asc" },
    }),
    db.paymentCharge.findMany({
      where: { member: { schoolId }, status: "pago" },
      include: { member: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
    db.fortunaTopUpCharge.findMany({
      where: { member: { schoolId }, status: "pago" },
      include: { member: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
    Promise.all([
      comAcessoVoluntario(activeMembers.map((m) => m.id)),
      db.liberadorNacional.findMany({ where: { mercurioId: { in: activeMembers.flatMap((m) => (m.mercurioId ? [m.mercurioId] : [])) } }, select: { mercurioId: true } }),
    ]),
    db.event.findMany({
      where: { schoolId },
      include: { registrations: { where: { desistenciaEm: null }, select: { id: true, paid: true, checkedIn: true, member: { select: { name: true } } } }, staff: true },
      orderBy: { startsAt: "desc" },
      take: 10,
    }),
    db.chargingRule.findMany({ where: { schoolId }, include: { triggers: true } }),
    db.chargeMessageDraft.findMany({
      where: { status: "pendente_aprovacao", member: { schoolId } },
      include: { member: { select: { name: true } }, chargeTrigger: true },
      orderBy: { createdAt: "asc" },
    }),
    db.crmContact.findMany({
      where: { resolvedAt: null, member: { schoolId } },
      include: { member: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // WhatsApp do financeiro (2026-10-26): mensagens do mês e custo abatido do repasse da filial.
    whatsappFinanceiroAtivo() ? custosDoMes(schoolId, mesAtual.ano, mesAtual.mes) : Promise.resolve({ centavos: 0, entregues: 0, falhas: 0, porModelo: [] }),
  ]);

  const atrasosMap = new Map(atrasosPorMembro.map((a) => [a.memberId, a._count._all]));
  const despesasPrevistas = despesasPendentes.reduce((soma, p) => soma + Number(p.amount), 0);
  const percentualConciliado = contasReais > 0 ? (contasReaisConciliadas / contasReais) * 100 : 100;

  // Resultado financeiro do mês corrente — decisão do usuário 2026-09-22:
  // MESMA lógica dos dois lados (projeção nos dois, não um realizado e
  // outro projetado). Receita prevista = contribuições recorrentes
  // (receitaPrevista, já é projeção — todo membro ativo, pago ou não) +
  // eventos previstos pra este mês (preço × inscritos, pago ou não —
  // mesmo raciocínio: é projeção, não o já recebido). Despesas previstas =
  // já gasto este mês + o que está programado pra vencer este mês (não
  // muda, já era assim).
  const despesasPendentesMes = despesasPendentes
    .filter((p) => p.dueDate >= inicioCivil && p.dueDate < fimCivil)
    .reduce((soma, p) => soma + Number(p.amount), 0);
  const despesasRealizadasMes = Number(despesasRealizadasMesAgg._sum.amount ?? 0);
  const despesasTotaisMes = despesasPendentesMes + despesasRealizadasMes;
  const receitaEventosMes = eventosMes.reduce((soma, e) => soma + Number(e.price) * e._count.registrations, 0);
  const receitaPrevistaMes = receitaPrevista + receitaEventosMes;

  // Saldo Fortuna NÃO é buscado aqui — bug real medido ao vivo (2026-09-21):
  // /diretor levava 7-9s porque isso rodava 1 chamada HTTP por membro
  // vinculado, em série, bloqueando o carregamento inteiro da página. Vira
  // getFortunaBalancesForDirector (fortuna-actions.ts), chamado client-side
  // e em paralelo — mesmo padrão já usado no Portal do Membro.
  const naoVinculadosFortuna = ativos.filter((m) => !m.fortunaClientId);
  const fortunaTransacoes = fortunaTxRecentes.map((t) => ({ memberName: t.member.name, amount: Number(t.amount) }));

  // As 2 fontes de PIX confirmado (contribuição + recarga Fortuna) juntas
  // numa lista só, mais recentes primeiro — antes só mostrava contribuição,
  // então uma recarga real de Fortuna nunca aparecia aqui.
  const transacoesRecentes: TransacaoRecente[] = [
    ...cobrancasPagas.map((c) => ({ id: c.id, memberName: c.member.name, amount: Number(c.amount), paidAt: c.paidAt!, tipo: "contribuicao" as const })),
    ...recargasFortunaPagas.map((r) => ({ id: r.id, memberName: r.member.name, amount: Number(r.amount), paidAt: r.paidAt!, tipo: "recarga_fortuna" as const })),
  ]
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, 10);

  const membrosRows: MemberRow[] = membros.map((m) => ({
    id: m.id,
    name: m.name,
    registrationNo: m.registrationNo,
    whatsapp: m.whatsapp,
    status: m.status,
    mercurioAtivo: m.mercurioAtivo,
    compositionLabels: m.compositionItems.map((i) => i.label),
    compositionTotal: totalComposicao(m),
    overdueCount: atrasosMap.get(m.id) ?? 0,
    avatarUrl: getAvatarUrl(m.avatarPath),
  }));

  const nationalIds = new Set(nationalAccess.map((m) => m.mercurioId));
  // Todos os ativos (26/10/2026): quem ainda não tem acesso de voluntário aparece marcado, e a tela pergunta se libera.
  const receptionCandidates = activeMembers.map((m) => ({ id: m.id, name: m.name, comAcesso: volunteerAccess.has(m.id) || !!(m.mercurioId && nationalIds.has(m.mercurioId)) }));

  // Cartazes e inscritos do Ulisses (27/10/2026: API do Ulisses, no máximo 6 s; sem resposta, sem número) em paralelo.
  const [eventPosters, inscritosUlisses] = await Promise.all([
    Promise.all(eventos.map(async (e) => [e.id, await eventPosterUrl(e.posterPath)] as const)).then((pares) => new Map(pares)),
    contarInscritosUlisses(eventos.filter((e) => e.source === "ulisses" && e.status === "publicado" && e.startsAt.getTime() > Date.now() - 30 * 864e5)),
  ]);
  const whatsappFinanceiro = { ligado: whatsappFinanceiroAtivo(), ano: mesAtual.ano, mes: mesAtual.mes, ...custosWhatsapp };

  return {
    receptionCandidates,
    // Cobrança sempre pela subconta da filial (2026-10-25).
    eventPaymentConfigured: !!escola?.asaasSubaccountApiKey,
    kpis: {
      receitaPrevista,
      receitaEventosMes,
      receitaPrevistaMes,
      despesasPrevistas,
      despesasRealizadasMes,
      despesasTotaisMes,
      resultadoFinanceiroMes: receitaPrevistaMes - despesasTotaisMes,
      taxaInadimplencia,
      totalEmAtraso,
      membrosAtivos: ativos.length,
      percentualConciliado,
    },
    transacoesRecentes,
    membros: membrosRows,
    despesasPendentes: despesasPendentes.map((p) => ({
      id: p.id,
      vendor: p.vendor,
      amount: Number(p.amount),
      dueDate: p.dueDate,
      predicted: p.predicted,
      recurring: p.recurring,
      recurrenceFrequency: p.recurrenceFrequency,
      rubricaId: p.rubricaId,
      rubricaLabel: p.rubrica?.label ?? null,
      documents: p.documents.map((d) => ({ id: d.id, title: d.title })),
    })),
    despesasRealizadas: despesasRealizadas.map((p) => ({
      id: p.id,
      vendor: p.vendor,
      amount: Number(p.amount),
      dueDate: p.dueDate,
      paidAt: p.paidAt!,
      predicted: p.predicted,
      recurring: p.recurring,
      recurrenceFrequency: p.recurrenceFrequency,
      rubricaId: p.rubricaId,
      rubricaLabel: p.rubrica?.label ?? null,
      documents: p.documents.map((d) => ({ id: d.id, title: d.title })),
    })),
    rubricasDisponiveis: rubricasDisponiveis.map((r) => ({ id: r.id, label: r.label })),
    fortunaTransacoes: fortunaTransacoes.slice(0, 10),
    fortunaNaoVinculados: naoVinculadosFortuna.map((m) => ({ id: m.id, name: m.name })),
    recargasFortunaPendentes: [
      ...recargasFortunaPendentesDedicadas.map((r) => ({
        source: "topup" as const,
        id: r.id,
        memberName: r.member.name,
        amount: Number(r.amount),
        paidAt: r.paidAt!,
        autoCreditError: r.autoCreditError,
      })),
      ...recargasFortunaPendentesCombinadas.map((r) => ({
        source: "contribuicao" as const,
        id: r.id,
        memberName: r.member.name,
        amount: Number(r.fortunaTopUpAmount),
        paidAt: r.paidAt!,
        autoCreditError: r.fortunaTopUpError,
      })),
    ].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime()),
    eventos: eventos.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      description: e.description,
      location: e.location,
      audience: e.audience,
      publicos: e.publicos,
      abertoA: e.abertoA,
      abertoValores: e.abertoValores,
      lancheCompartilhado: e.lancheCompartilhado,
      linkPostagemOficial: e.linkPostagemOficial,
      prazoDesistenciaDias: e.prazoDesistenciaDias,
      posterPath:e.posterPath,
      posterUrl:eventPosters.get(e.id)??null,
      capacity:e.capacity,
      registrationClosesAt:e.registrationClosesAt,
      participantInstructions:e.participantInstructions,
      contactInfo:e.contactInfo,
      revision: e.revision,
      status: e.status,
      source: e.source,
      staff: e.staff.map(s=>s.memberId),
      price: Number(e.price),
      inscritos: e.registrations.length,
      inscritosUlisses: inscritosUlisses.get(e.id) ?? null,
      presentes: e.registrations.filter((r) => r.checkedIn).length,
      registrations: e.registrations.map((r) => ({ id: r.id, memberName: r.member.name, paid: r.paid, checkedIn: r.checkedIn })),
    })),
    whatsappFinanceiro,
    regrasDeCobranca: regrasDeCobranca.map((r) => ({
      id: r.id,
      name: r.name,
      triggers: r.triggers.map((t) => ({ id: t.id, type: t.type, active: t.active, messageTemplate: t.messageTemplate })),
    })),
    rascunhosPendentes: rascunhosPendentes.map((d) => ({
      id: d.id,
      memberName: d.member.name,
      triggerType: d.chargeTrigger.type,
      body: d.body,
      createdAt: d.createdAt,
    })),
    negociacoesAbertas: negociacoesAbertas.map((n) => ({
      id: n.id,
      memberName: n.member.name,
      notes: n.notes,
      promisedPaymentDate: n.promisedPaymentDate,
      createdAt: n.createdAt,
    })),
  };
}

export type DirectorDashboard = Awaited<ReturnType<typeof getDirectorDashboard>>;
