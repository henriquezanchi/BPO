import { CATEGORIAS_OUTRAS_RECEITAS, LABEL_OUTRAS_RECEITAS, categorizarRubrica, type CategoriaDespesa } from "@/lib/finance-categories";
import { db } from "@/lib/db";

/**
 * Transparência Financeira — pedido de dirigentes repassado pelo usuário
 * 2026-09-30: membros querem ver em que o dinheiro da escola é usado, mas
 * um balanço contábil cru não diz nada pra maioria. Aqui: indicadores
 * práticos (quanto entrou, de onde, quanto saiu, em quê) pro mês
 * escolhido — sempre REALIZADO (já recebido/já pago), diferente do
 * "Resultado Financeiro do Mês" do painel do diretor, que é projeção.
 */
export async function getTransparenciaFinanceira(schoolId: string, ano: number, mes: number) {
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMes = new Date(Date.UTC(ano, mes, 1));

  const contribuicoesAgg = await db.paymentCharge.aggregate({
    where: { member: { schoolId }, status: "pago", paidAt: { gte: inicioMes, lt: fimMes } },
    _sum: { amount: true, fortunaTopUpAmount: true },
  });
  const contribuicoes = Number(contribuicoesAgg._sum.amount ?? 0);

  const fortunaTopUpDedicadoAgg = await db.fortunaTopUpCharge.aggregate({
    where: { member: { schoolId }, status: "pago", paidAt: { gte: inicioMes, lt: fimMes } },
    _sum: { amount: true },
  });
  const lanchonete = Number(fortunaTopUpDedicadoAgg._sum.amount ?? 0) + Number(contribuicoesAgg._sum.fortunaTopUpAmount ?? 0);

  const eventosDoMes = await db.event.findMany({
    where: { schoolId, startsAt: { gte: inicioMes, lt: fimMes } },
    include: { registrations: { where: { paid: true } } },
  });
  const eventos = eventosDoMes.reduce((soma, e) => soma + Number(e.price) * e.registrations.length, 0);

  const outrasManual = await db.otherIncome.findMany({ where: { schoolId, receivedAt: { gte: inicioMes, lt: fimMes } } });
  const outrasPorCategoria = Object.fromEntries(CATEGORIAS_OUTRAS_RECEITAS.map((c) => [c, 0])) as Record<string, number>;
  for (const o of outrasManual) outrasPorCategoria[o.category] = (outrasPorCategoria[o.category] ?? 0) + Number(o.amount);
  const outrasTotal = Object.values(outrasPorCategoria).reduce((a, b) => a + b, 0);

  const receitaTotal = contribuicoes + lanchonete + eventos + outrasTotal;

  const ativos = await db.member.findMany({ where: { schoolId, mercurioAtivo: true }, select: { status: true } });
  const taxaInadimplencia = ativos.length > 0 ? (ativos.filter((m) => m.status === "atrasado").length / ativos.length) * 100 : 0;

  const despesasPagas = await db.payable.findMany({
    where: { schoolId, paidAt: { gte: inicioMes, lt: fimMes } },
    include: { rubrica: true },
  });
  const despesaTotal = despesasPagas.reduce((soma, p) => soma + Number(p.amount), 0);
  const despesasPorCategoriaMap = new Map<CategoriaDespesa, number>();
  for (const p of despesasPagas) {
    const categoria = categorizarRubrica(p.rubrica?.label);
    despesasPorCategoriaMap.set(categoria, (despesasPorCategoriaMap.get(categoria) ?? 0) + Number(p.amount));
  }
  const despesasPorCategoria = [...despesasPorCategoriaMap.entries()]
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);

  return {
    ano,
    mes,
    receitaTotal,
    despesaTotal,
    resultado: receitaTotal - despesaTotal,
    receitas: {
      contribuicoes,
      eventos,
      lanchonete,
      outras: CATEGORIAS_OUTRAS_RECEITAS.map((c) => ({ categoria: c, label: LABEL_OUTRAS_RECEITAS[c], valor: outrasPorCategoria[c] })).filter(
        (o) => o.valor > 0,
      ),
    },
    taxaInadimplencia,
    despesasPorCategoria,
    despesasNaoCategorizadas: despesasPagas.filter((p) => !p.rubricaId).length,
  };
}

export type TransparenciaFinanceira = Awaited<ReturnType<typeof getTransparenciaFinanceira>>;
