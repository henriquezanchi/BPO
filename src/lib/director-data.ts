import { db } from "@/lib/db";
import { fortunaGetClient } from "@/lib/fortuna/client";

export interface MemberRow {
  id: string;
  name: string;
  registrationNo: string | null;
  whatsapp: string;
  status: string;
  compositionLabels: string[];
  compositionTotal: number;
}

export interface TransacaoRecente {
  id: string;
  memberName: string;
  amount: number;
  paidAt: Date;
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

  const despesasPendentes = await db.payable.findMany({ where: { schoolId, paidAt: null }, orderBy: { dueDate: "asc" } });
  const despesasPrevistas = despesasPendentes.reduce((soma, p) => soma + Number(p.amount), 0);

  // Saldo Fortuna consolidado — só quem já está vinculado (fortunaClientId,
  // ver scripts/link-fortuna-clients.ts). É uma API real, então isso é 1
  // chamada por membro vinculado — tudo bem na escala de hoje (poucos
  // membros vinculados), reconsiderar se crescer muito.
  const vinculadosFortuna = membros.filter((m) => m.fortunaClientId);
  let saldoFortunaConsolidado = 0;
  const fortunaTransacoes: { memberName: string; amount: number }[] = [];
  for (const m of vinculadosFortuna) {
    try {
      const cliente = await fortunaGetClient(m.fortunaClientId!);
      saldoFortunaConsolidado += cliente.balance.reduce((soma, b) => soma + Number(b.amount), 0);
    } catch {
      // Best-effort — 1 cliente falhar (API fora do ar, id desvinculado) não derruba o resto do painel.
    }
  }
  const fortunaTxRecentes = await db.fortunaTransaction.findMany({
    where: { member: { schoolId } },
    include: { member: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  fortunaTransacoes.push(...fortunaTxRecentes.map((t) => ({ memberName: t.member.name, amount: Number(t.amount) })));

  const cobrancasPagas = await db.paymentCharge.findMany({
    where: { member: { schoolId }, status: "pago" },
    include: { member: true },
    orderBy: { paidAt: "desc" },
    take: 10,
  });
  const transacoesRecentes: TransacaoRecente[] = cobrancasPagas.map((c) => ({
    id: c.id,
    memberName: c.member.name,
    amount: Number(c.amount),
    paidAt: c.paidAt!,
  }));

  const membrosRows: MemberRow[] = membros.map((m) => ({
    id: m.id,
    name: m.name,
    registrationNo: m.registrationNo,
    whatsapp: m.whatsapp,
    status: m.status,
    compositionLabels: m.compositionItems.map((i) => i.label),
    compositionTotal: totalComposicao(m),
  }));

  const eventos = await db.event.findMany({
    where: { schoolId },
    include: { registrations: { include: { member: true } } },
    orderBy: { startsAt: "desc" },
    take: 10,
  });

  const regrasDeCobranca = await db.chargingRule.findMany({ where: { schoolId }, include: { triggers: true } });

  return {
    kpis: {
      receitaPrevista,
      despesasPrevistas,
      taxaInadimplencia,
      totalEmAtraso,
      saldoFortunaConsolidado,
      membrosAtivos: ativos.length,
    },
    transacoesRecentes,
    membros: membrosRows,
    despesasPendentes: despesasPendentes.map((p) => ({ id: p.id, vendor: p.vendor, amount: Number(p.amount), dueDate: p.dueDate, hasInvoice: p.hasInvoice })),
    fortunaTransacoes: fortunaTransacoes.slice(0, 10),
    eventos: eventos.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      price: Number(e.price),
      inscritos: e.registrations.length,
      presentes: e.registrations.filter((r) => r.checkedIn).length,
      registrations: e.registrations.map((r) => ({ id: r.id, memberName: r.member.name, paid: r.paid, checkedIn: r.checkedIn })),
    })),
    regrasDeCobranca: regrasDeCobranca.map((r) => ({ id: r.id, name: r.name, triggers: r.triggers.length })),
  };
}

export type DirectorDashboard = Awaited<ReturnType<typeof getDirectorDashboard>>;
