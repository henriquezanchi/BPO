"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseOfxDebitos } from "@/lib/ofx-parser";
import { revalidatePath } from "next/cache";

/**
 * Prevê a conta do MÊS SEGUINTE por recorrência: mesmo fornecedor (nome
 * normalizado) aparecendo nos 2 últimos meses (o atual e o anterior,
 * dentre as contas REAIS — predicted:false — da escola) gera uma nova
 * conta prevista (predicted:true) pro mês seguinte, se ainda não existir
 * uma pra esse fornecedor naquele mês. Heurística simples (nome exato
 * normalizado, sem tolerância de valor) — limitação anotada: extrato com
 * descrição levemente diferente mês a mês (nº de documento etc) não bate.
 */
async function preverContasProximoMes(schoolId: string): Promise<number> {
  const agora = new Date();
  const anoAtual = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth();
  const inicioJanela = new Date(Date.UTC(anoAtual, mesAtual - 1, 1));
  const fimJanela = new Date(Date.UTC(anoAtual, mesAtual + 1, 1));

  const payables = await db.payable.findMany({
    where: { schoolId, predicted: false, dueDate: { gte: inicioJanela, lt: fimJanela } },
  });

  const porFornecedor = new Map<string, typeof payables>();
  for (const p of payables) {
    const chave = p.vendor.trim().toUpperCase();
    porFornecedor.set(chave, [...(porFornecedor.get(chave) ?? []), p]);
  }

  let previstas = 0;
  for (const itens of porFornecedor.values()) {
    const mesesDistintos = new Set(itens.map((p) => `${p.dueDate.getUTCFullYear()}-${p.dueDate.getUTCMonth()}`));
    if (mesesDistintos.size < 2) continue; // só prevê se apareceu nos 2 últimos meses

    const maisRecente = itens.reduce((a, b) => (a.dueDate > b.dueDate ? a : b));
    const proximoMesInicio = new Date(Date.UTC(maisRecente.dueDate.getUTCFullYear(), maisRecente.dueDate.getUTCMonth() + 1, 1));
    const proximoMesFim = new Date(Date.UTC(maisRecente.dueDate.getUTCFullYear(), maisRecente.dueDate.getUTCMonth() + 2, 1));
    const dueDatePrevista = new Date(Date.UTC(maisRecente.dueDate.getUTCFullYear(), maisRecente.dueDate.getUTCMonth() + 1, maisRecente.dueDate.getUTCDate()));

    const jaExiste = await db.payable.findFirst({
      where: { schoolId, vendor: { equals: maisRecente.vendor, mode: "insensitive" }, dueDate: { gte: proximoMesInicio, lt: proximoMesFim } },
    });
    if (jaExiste) continue;

    await db.payable.create({
      data: { schoolId, vendor: maisRecente.vendor, amount: maisRecente.amount, dueDate: dueDatePrevista, predicted: true, recurring: true },
    });
    previstas++;
  }

  return previstas;
}

/**
 * Importa um extrato OFX — só DÉBITOS por decisão explícita do usuário
 * (crédito/conciliação com lançamento no Mercúrio fica pra depois). Cada
 * transação vira uma Payable já como PAGA (dueDate=paidAt=data do
 * extrato, já que extrato representa o passado), deduplicada por FITID
 * (@@unique em bankFitId — reimportar o mesmo extrato não duplica nada).
 * Ao final, roda a previsão de recorrência pro mês seguinte.
 */
export async function importarExtratoOfx(schoolId: string, formData: FormData) {
  await requireDirector(schoolId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Selecione um arquivo OFX.");

  const conteudo = await file.text();
  const transacoes = parseOfxDebitos(conteudo);
  if (transacoes.length === 0) throw new Error("Nenhum débito encontrado no arquivo — confirme que é um extrato OFX válido.");

  let importadas = 0;
  let duplicadas = 0;
  for (const t of transacoes) {
    try {
      await db.payable.create({
        data: { schoolId, vendor: t.descricao, amount: Math.abs(t.valor), dueDate: t.data, paidAt: t.data, bankFitId: t.fitId },
      });
      importadas++;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") duplicadas++; // já importado antes (mesmo FITID)
      else throw e;
    }
  }

  const previstas = await preverContasProximoMes(schoolId);
  revalidatePath("/diretor");
  return { importadas, duplicadas, previstas };
}

export async function confirmarPrevisao(schoolId: string, payableId: string) {
  await requireDirector(schoolId);
  const payable = await db.payable.findUniqueOrThrow({ where: { id: payableId } });
  if (payable.schoolId !== schoolId) throw new Error("Conta não pertence a esta escola.");

  await db.payable.update({ where: { id: payableId }, data: { predicted: false } });
  revalidatePath("/diretor");
}

export async function removerPrevisao(schoolId: string, payableId: string) {
  await requireDirector(schoolId);
  const payable = await db.payable.findUniqueOrThrow({ where: { id: payableId } });
  if (payable.schoolId !== schoolId || !payable.predicted) throw new Error("Só é possível remover previsões automáticas.");

  await db.payable.delete({ where: { id: payableId } });
  revalidatePath("/diretor");
}
