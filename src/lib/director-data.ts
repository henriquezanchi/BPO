import { db } from "@/lib/db";

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
  const membros = await db.member.findMany({
    where: { schoolId },
    include: { compositionItems: true },
    orderBy: { name: "asc" },
  });

  const ativos = membros.filter((m) => m.mercurioAtivo);
  const atrasados = ativos.filter((m) => m.status === "atrasado");

  const totalComposicao = (m: (typeof membros)[number]) => m.compositionItems.reduce((soma, i) => soma + Number(i.amount), 0);

  const receitaPrevista = ativos.reduce((soma, m) => soma + totalComposicao(m), 0);
  const totalEmAtraso = atrasados.reduce((soma, m) => soma + totalComposicao(m), 0);
  const taxaInadimplencia = ativos.length > 0 ? (atrasados.length / ativos.length) * 100 : 0;

  const atrasosPorMembro = await db.contributionMonthlyStatus.groupBy({
    by: ["memberId"],
    where: { member: { schoolId }, status: "atrasado" },
    _count: { _all: true },
  });
  const atrasosMap = new Map(atrasosPorMembro.map((a) => [a.memberId, a._count._all]));

  const despesasPendentes = await db.payable.findMany({
    where: { schoolId, paidAt: null },
    include: { documents: true, rubrica: true },
    orderBy: { dueDate: "asc" },
  });
  const despesasPrevistas = despesasPendentes.reduce((soma, p) => soma + Number(p.amount), 0);
  // take maior que antes (era 20) — agora agrupado por mês em gavetas
  // colapsáveis na UI, então precisa de histórico suficiente pra mostrar
  // mais de 1-2 meses fechados antes do atual.
  const despesasRealizadas = await db.payable.findMany({
    where: { schoolId, paidAt: { not: null } },
    include: { documents: true, rubrica: true },
    orderBy: { paidAt: "desc" },
    take: 200,
  });

  const rubricasDisponiveis = await db.schoolPaymentRubrica.findMany({ where: { schoolId }, orderBy: { label: "asc" } });

  // % conciliado (medidor) — só considera contas REAIS (não previsão
  // automática ainda não confirmada) que já deveriam ter documento: uma
  // conta "conciliada" é a que tem pelo menos 1 recibo/NF anexado.
  const todasReais = await db.payable.findMany({ where: { schoolId, predicted: false }, include: { documents: true } });
  const percentualConciliado = todasReais.length > 0 ? (todasReais.filter((p) => p.documents.length > 0).length / todasReais.length) * 100 : 100;

  // Resultado financeiro do mês corrente — receita prevista (recorrente,
  // mensal) vs. despesas do mês (previstas com vencimento este mês +
  // realizadas pagas este mês), pra dar 1 número só de "estamos indo bem
  // ou mal este mês" no topo da Visão Geral.
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const despesasPendentesMes = despesasPendentes
    .filter((p) => p.dueDate >= inicioMes && p.dueDate < fimMes)
    .reduce((soma, p) => soma + Number(p.amount), 0);
  const despesasRealizadasMesAgg = await db.payable.aggregate({
    where: { schoolId, paidAt: { gte: inicioMes, lt: fimMes } },
    _sum: { amount: true },
  });
  const despesasRealizadasMes = Number(despesasRealizadasMesAgg._sum.amount ?? 0);
  const despesasTotaisMes = despesasPendentesMes + despesasRealizadasMes;

  // Saldo Fortuna NÃO é buscado aqui — bug real medido ao vivo (2026-09-21):
  // /diretor levava 7-9s porque isso rodava 1 chamada HTTP por membro
  // vinculado, em série, bloqueando o carregamento inteiro da página. Vira
  // getFortunaBalancesForDirector (fortuna-actions.ts), chamado client-side
  // e em paralelo — mesmo padrão já usado no Portal do Membro.
  const naoVinculadosFortuna = ativos.filter((m) => !m.fortunaClientId);
  const fortunaTransacoes: { memberName: string; amount: number }[] = [];
  const fortunaTxRecentes = await db.fortunaTransaction.findMany({
    where: { member: { schoolId } },
    include: { member: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  fortunaTransacoes.push(...fortunaTxRecentes.map((t) => ({ memberName: t.member.name, amount: Number(t.amount) })));

  // Recargas pagas via PIX cujo crédito AUTOMÁTICO no Fortuna falhou (ver
  // checkFortunaTopUpStatus) — fila de exceção pra lançamento manual, não o
  // caminho normal (que já credita sozinho assim que o PIX é confirmado).
  const recargasFortunaPendentes = await db.fortunaTopUpCharge.findMany({
    where: { member: { schoolId }, status: "pago", launchedAt: null },
    include: { member: true },
    orderBy: { paidAt: "asc" },
  });

  const cobrancasPagas = await db.paymentCharge.findMany({
    where: { member: { schoolId }, status: "pago" },
    include: { member: true },
    orderBy: { paidAt: "desc" },
    take: 10,
  });
  const recargasFortunaPagas = await db.fortunaTopUpCharge.findMany({
    where: { member: { schoolId }, status: "pago" },
    include: { member: true },
    orderBy: { paidAt: "desc" },
    take: 10,
  });
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
  }));

  const eventos = await db.event.findMany({
    where: { schoolId },
    include: { registrations: { include: { member: true } } },
    orderBy: { startsAt: "desc" },
    take: 10,
  });

  const regrasDeCobranca = await db.chargingRule.findMany({ where: { schoolId }, include: { triggers: true } });

  const rascunhosPendentes = await db.chargeMessageDraft.findMany({
    where: { status: "pendente_aprovacao", member: { schoolId } },
    include: { member: true, chargeTrigger: true },
    orderBy: { createdAt: "asc" },
  });

  const negociacoesAbertas = await db.crmContact.findMany({
    where: { resolvedAt: null, member: { schoolId } },
    include: { member: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    kpis: {
      receitaPrevista,
      despesasPrevistas,
      despesasRealizadasMes,
      despesasTotaisMes,
      resultadoFinanceiroMes: receitaPrevista - despesasTotaisMes,
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
    recargasFortunaPendentes: recargasFortunaPendentes.map((r) => ({
      id: r.id,
      memberName: r.member.name,
      amount: Number(r.amount),
      paidAt: r.paidAt!,
      autoCreditError: r.autoCreditError,
    })),
    eventos: eventos.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      price: Number(e.price),
      inscritos: e.registrations.length,
      presentes: e.registrations.filter((r) => r.checkedIn).length,
      registrations: e.registrations.map((r) => ({ id: r.id, memberName: r.member.name, paid: r.paid, checkedIn: r.checkedIn })),
    })),
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
