"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACCOUNTANT_DOCS_BUCKET as BUCKET } from "@/lib/storage-constants";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Prisma, RecurrenceFrequency } from "@prisma/client";
import { revalidatePath } from "next/cache";

/** dd/mm/aaaa "andado" de acordo com a frequência — usado tanto ao criar a próxima ocorrência quanto validado na UI (charging-labels.ts tem o rótulo de cada uma). */
function proximaData(data: Date, frequency: RecurrenceFrequency): Date {
  const d = new Date(data);
  switch (frequency) {
    case "diaria":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "semanal":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "quinzenal":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "mensal":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "bimestral":
      d.setUTCMonth(d.getUTCMonth() + 2);
      break;
    case "semestral":
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    case "anual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d;
}

/** Registro MANUAL de repasse — decisão explícita do usuário: sem leitura em tempo real da API do Asaas (ver plano). */
export async function registrarRepasse(schoolId: string, amount: number, referenceYear: number, referenceMonth: number, note?: string) {
  await requireDirector(schoolId);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor inválido.");
  if (referenceMonth < 1 || referenceMonth > 12) throw new Error("Mês inválido.");

  await db.repasse.create({ data: { schoolId, amount, referenceYear, referenceMonth, note: note?.trim() || null } });
  revalidatePath("/diretor");
}

/**
 * Garante que a PRÓXIMA ocorrência de uma conta recorrente já exista
 * (predicted:true — previsão, não pagamento real ainda), na data seguinte
 * conforme a frequência escolhida — chamada tanto na criação
 * (recurring:true) quanto ao marcar como paga, pra cadeia continuar sem
 * precisar de padrão detectado em extrato. Dedupe por fornecedor + data
 * EXATA (não por mês — frequências diária/semanal/quinzenal têm mais de 1
 * ocorrência no mesmo mês).
 */
async function gerarProximaOcorrencia(payable: { schoolId: string; vendor: string; amount: Prisma.Decimal; dueDate: Date; recurrenceFrequency: RecurrenceFrequency | null }) {
  const frequency = payable.recurrenceFrequency ?? "mensal";
  const dueDatePrevista = proximaData(payable.dueDate, frequency);

  const jaExiste = await db.payable.findFirst({
    where: { schoolId: payable.schoolId, vendor: { equals: payable.vendor, mode: "insensitive" }, dueDate: dueDatePrevista },
  });
  if (jaExiste) return;

  await db.payable.create({
    data: {
      schoolId: payable.schoolId,
      vendor: payable.vendor,
      amount: payable.amount,
      dueDate: dueDatePrevista,
      predicted: true,
      recurring: true,
      recurrenceFrequency: frequency,
    },
  });
}

/**
 * hasInvoice começa sempre falso — só vira true quando um documento real é
 * anexado (ver accountant-actions.ts). `recurring`/`frequency` são decisão
 * explícita do diretor na criação — já gera a próxima ocorrência na hora,
 * diferente da previsão por padrão detectado em extrato
 * (bank-import-actions.ts), que só prevê depois de ver 2 meses reais (e é
 * sempre mensal).
 */
export async function criarContaAPagar(schoolId: string, vendor: string, amount: number, dueDate: string, recurring: boolean, frequency: RecurrenceFrequency | null) {
  await requireDirector(schoolId);
  if (!vendor.trim()) throw new Error("Fornecedor não pode ser vazio.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor inválido.");

  const parsedDueDate = new Date(dueDate);
  const recurrenceFrequency = recurring ? (frequency ?? "mensal") : null;
  const payable = await db.payable.create({ data: { schoolId, vendor: vendor.trim(), amount, dueDate: parsedDueDate, recurring, recurrenceFrequency } });
  if (recurring) await gerarProximaOcorrencia(payable);
  revalidatePath("/diretor");
}

export async function marcarContaComoPaga(schoolId: string, payableId: string) {
  await requireDirector(schoolId);
  const payable = await db.payable.findUniqueOrThrow({ where: { id: payableId } });
  if (payable.schoolId !== schoolId) throw new Error("Conta não pertence a esta escola.");

  await db.payable.update({ where: { id: payableId }, data: { paidAt: new Date() } });
  if (payable.recurring) await gerarProximaOcorrencia(payable);
  revalidatePath("/diretor");
}

/** Desfaz "Marcar pago" — volta pra Previstas (ex: marcou por engano). */
export async function desmarcarContaComoPaga(schoolId: string, payableId: string) {
  await requireDirector(schoolId);
  const payable = await db.payable.findUniqueOrThrow({ where: { id: payableId } });
  if (payable.schoolId !== schoolId) throw new Error("Conta não pertence a esta escola.");

  await db.payable.update({ where: { id: payableId }, data: { paidAt: null } });
  revalidatePath("/diretor");
}

export async function editarContaAPagar(schoolId: string, payableId: string, vendor: string, amount: number, dueDate: string) {
  await requireDirector(schoolId);
  const payable = await db.payable.findUniqueOrThrow({ where: { id: payableId } });
  if (payable.schoolId !== schoolId) throw new Error("Conta não pertence a esta escola.");
  if (!vendor.trim()) throw new Error("Fornecedor não pode ser vazio.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor inválido.");

  await db.payable.update({ where: { id: payableId }, data: { vendor: vendor.trim(), amount, dueDate: new Date(dueDate) } });
  revalidatePath("/diretor");
}

/** Exclui a conta E os documentos anexados a ela (arquivo real no Storage também — não deixa órfão). */
export async function excluirContaAPagar(schoolId: string, payableId: string) {
  await requireDirector(schoolId);
  const payable = await db.payable.findUniqueOrThrow({ where: { id: payableId }, include: { documents: true } });
  if (payable.schoolId !== schoolId) throw new Error("Conta não pertence a esta escola.");

  if (payable.documents.length > 0) {
    await supabaseAdmin.storage.from(BUCKET).remove(payable.documents.map((d) => d.filePath));
    await db.accountantDocument.deleteMany({ where: { payableId } });
  }
  await db.payable.delete({ where: { id: payableId } });
  revalidatePath("/diretor");
}
