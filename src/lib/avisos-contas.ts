import { Prisma } from "@prisma/client";
import { areasNaFilial } from "@/lib/areas-filial";
import { db } from "@/lib/db";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { agoraNoFuso } from "@/lib/lembrete-aula";
import { somarDias } from "@/lib/oportunidades-comum";
import { enviarPush } from "@/lib/push";

/**
 * Agenda de pagamentos (pedido do usuário 09/11/2026): as contas a pagar da Economia (Payable, aba Contas) avisam no
 * celular de quem tem a área de Economia na filial, às 8h do fuso da filial: na véspera ("amanhã vence") e no dia
 * ("vence hoje"). Só contas em aberto; previsões automáticas entram marcadas como previstas. O vencimento é gravado como
 * a data pura (meia-noite UTC), então a comparação é pela data AAAA-MM-DD.
 */
export const HORA_AVISO_CONTAS = 8;

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function textoContasDoDia(contas: { vendor: string; amount: number; predicted: boolean }[], quando: "hoje" | "amanha") {
  const total = contas.reduce((s, c) => s + c.amount, 0);
  const titulo = contas.length === 1 ? `Conta vence ${quando === "hoje" ? "hoje" : "amanhã"}: ${contas[0].vendor}` : `${contas.length} contas vencem ${quando === "hoje" ? "hoje" : "amanhã"} · ${reais(total)}`;
  const linhas = contas.slice(0, 3).map((c) => `${c.vendor} ${reais(c.amount)}${c.predicted ? " (prevista)" : ""}`);
  return {
    titulo,
    corpo: `${contas.length === 1 ? reais(contas[0].amount) + (contas[0].predicted ? " (prevista)" : "") : linhas.join("; ") + (contas.length > 3 ? "..." : "")}. Depois de pagar, marque como paga na Economia.`,
  };
}

async function reservar(chave: string) {
  try {
    await db.pushEnviado.create({ data: { chave } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

export async function avisosDeContasAPagar(agora = new Date()) {
  let total = 0;
  const escolas = await db.school.findMany({ where: { payables: { some: { paidAt: null } } }, select: { id: true, uf: true } });
  for (const escola of escolas) {
    const { hoje, minuto } = agoraNoFuso(agora, fusoDaEscola(escola.uf));
    if (minuto < HORA_AVISO_CONTAS * 60 || minuto >= 20 * 60) continue;
    if (!(await reservar(`contas:${escola.id}:${hoje}`))) continue;
    const amanha = somarDias(hoje, 1);
    const contas = await db.payable.findMany({
      where: { schoolId: escola.id, paidAt: null, dueDate: { gte: new Date(`${hoje}T00:00:00Z`), lt: new Date(`${somarDias(hoje, 2)}T00:00:00Z`) } },
      select: { vendor: true, amount: true, dueDate: true, predicted: true },
      orderBy: { amount: "desc" },
    });
    if (!contas.length) continue;
    const pessoas = await db.member.findMany({ where: { schoolId: escola.id, mercurioAtivo: true, pushSubscriptions: { some: {} } } });
    const economia = (await Promise.all(pessoas.map(async (p) => ((await areasNaFilial(p, escola.id)).includes("economia") ? p.id : null)))).filter((x): x is string => !!x);
    if (!economia.length) continue;
    for (const [quando, dia] of [["hoje", hoje], ["amanha", amanha]] as const) {
      const lista = contas.filter((c) => c.dueDate.toISOString().slice(0, 10) === dia).map((c) => ({ vendor: c.vendor, amount: Number(c.amount), predicted: c.predicted }));
      if (!lista.length) continue;
      total += (await enviarPush(economia, { ...textoContasDoDia(lista, quando), url: "/economia?aba=contas", etiqueta: `contas-${escola.id}-${dia}` })).pessoas;
    }
  }
  return total;
}
