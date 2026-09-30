import {
  CATEGORIAS_OUTRAS_RECEITAS,
  LABEL_OUTRAS_RECEITAS,
  categorizarReceita,
  categorizarRubrica,
  type CategoriaDespesa,
} from "@/lib/finance-categories";
import { db } from "@/lib/db";
import type { MovimentoRubrica } from "@/lib/mercurio/browser-session";

/**
 * Transparência Financeira — pedido de dirigentes repassado pelo usuário
 * 2026-09-30: membros querem ver em que o dinheiro da escola é usado, mas
 * um balanço contábil cru não diz nada pra maioria. Indicadores práticos
 * (quanto entrou, de onde, quanto saiu, em quê) pro mês escolhido — sempre
 * REALIZADO, diferente do "Resultado Financeiro do Mês" do painel do
 * diretor, que é projeção.
 *
 * Fonte dos dados: o relatório REAL "Movimento do Período" do Mercúrio
 * (Tesouraria > Movimento > Sintético — ver
 * mercurio/browser-session.ts#lerMovimentoSintetico), não mais tabelas
 * locais — achado do usuário 2026-09-30: a versão anterior juntava
 * PaymentCharge/Event/FortunaTopUpCharge (não pegava pagamento feito direto
 * na secretaria) e dependia de upload manual de extrato OFX pro lado da
 * despesa. Esta função só MONTA o payload a partir das linhas já
 * raspadas — quem chama (scripts/sync-financial-snapshot.ts) é responsável
 * por abrir a sessão do Mercúrio (Playwright não roda no Vercel).
 */
export async function construirTransparenciaDeMovimento(schoolId: string, ano: number, mes: number, linhasMovimento: MovimentoRubrica[]) {
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMes = new Date(Date.UTC(ano, mes, 1));

  let contribuicoes = 0;
  let eventos = 0;
  let lanchonete = 0;
  const outrasPorCategoria = Object.fromEntries(CATEGORIAS_OUTRAS_RECEITAS.map((c) => [c, 0])) as Record<string, number>;
  const despesasPorCategoriaMap = new Map<CategoriaDespesa, number>();

  for (const linha of linhasMovimento) {
    if (linha.entradas > 0) {
      const categoria = categorizarReceita(linha.rubrica);
      if (categoria === "contribuicoes") contribuicoes += linha.entradas;
      else if (categoria === "eventos") eventos += linha.entradas;
      else if (categoria === "lanchonete") lanchonete += linha.entradas;
      else outrasPorCategoria[categoria] = (outrasPorCategoria[categoria] ?? 0) + linha.entradas;
    }
    if (linha.saidas > 0) {
      const categoria = categorizarRubrica(linha.rubrica);
      despesasPorCategoriaMap.set(categoria, (despesasPorCategoriaMap.get(categoria) ?? 0) + linha.saidas);
    }
  }

  // Receita manual que não passa pelo caixa do Mercúrio (ver OtherIncome) —
  // soma em cima do que o Movimento já capturou, não substitui.
  const outrasManual = await db.otherIncome.findMany({ where: { schoolId, receivedAt: { gte: inicioMes, lt: fimMes } } });
  for (const o of outrasManual) outrasPorCategoria[o.category] = (outrasPorCategoria[o.category] ?? 0) + Number(o.amount);
  const outrasTotal = Object.values(outrasPorCategoria).reduce((a, b) => a + b, 0);

  const receitaTotal = contribuicoes + eventos + lanchonete + outrasTotal;
  const despesaTotal = [...despesasPorCategoriaMap.values()].reduce((a, b) => a + b, 0);

  const ativos = await db.member.findMany({ where: { schoolId, mercurioAtivo: true }, select: { status: true } });
  const taxaInadimplencia = ativos.length > 0 ? (ativos.filter((m) => m.status === "atrasado").length / ativos.length) * 100 : 0;

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
  };
}

export type TransparenciaFinanceira = Awaited<ReturnType<typeof construirTransparenciaDeMovimento>>;

/**
 * Um mês só é considerado "fechado" (dado estável, pronto pra exibir) a
 * partir do mês seguinte — decisão do usuário 2026-09-30, pra não mostrar
 * número parcial de um mês ainda em andamento no Mercúrio.
 */
function ultimoMesFechado(): { ano: number; mes: number } {
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  return mesAtual === 1 ? { ano: anoAtual - 1, mes: 12 } : { ano: anoAtual, mes: mesAtual - 1 };
}

function mesEstaFechado(ano: number, mes: number): boolean {
  const ultimo = ultimoMesFechado();
  return ano < ultimo.ano || (ano === ultimo.ano && mes <= ultimo.mes);
}

export type TransparenciaResposta =
  | { ano: number; mes: number; status: "disponivel"; dados: TransparenciaFinanceira }
  // Mês já fechou mas o worker (scripts/sync-financial-snapshot.ts, roda
  // 1x por dia) ainda não gerou o snapshot — diferente de "em_andamento"
  // pra não confundir "ainda não fechou" com "só falta processar".
  | { ano: number; mes: number; status: "processando" }
  | { ano: number; mes: number; status: "em_andamento" };

/**
 * Único caminho de leitura pro Portal do Membro — só lê o snapshot já
 * cacheado (ver FinancialSnapshot/scripts/sync-financial-snapshot.ts),
 * NUNCA recalcula na hora: todos os membros da escola veem exatamente o
 * mesmo número, vindo da mesma fonte, sem reprocessar a cada clique.
 */
export async function getTransparenciaFechada(schoolId: string, ano: number, mes: number): Promise<TransparenciaResposta> {
  if (!mesEstaFechado(ano, mes)) return { ano, mes, status: "em_andamento" };

  const snapshot = await db.financialSnapshot.findUnique({ where: { schoolId_ano_mes: { schoolId, ano, mes } } });
  if (!snapshot) return { ano, mes, status: "processando" };

  return { ano, mes, status: "disponivel", dados: snapshot.payload as unknown as TransparenciaFinanceira };
}

export { ultimoMesFechado };
