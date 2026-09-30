"use server";

import { requireAuthenticatedMember, requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTransparenciaFinanceira } from "@/lib/transparency-data";
import { revalidatePath } from "next/cache";

/** Chamado pelo Portal do Membro — qualquer membro autenticado vê a transparência da própria escola. */
export async function getTransparenciaParaMembro(memberId: string, ano: number, mes: number) {
  const member = await requireAuthenticatedMember(memberId);
  return getTransparenciaFinanceira(member.schoolId, ano, mes);
}

/** Lançamento manual de receita que não passa pelo Portal (livraria, cursos, doações) — ver finance-categories.ts. */
export async function lancarOutraReceita(schoolId: string, category: string, amount: number, receivedAt: string, note?: string) {
  await requireDirector(schoolId);
  if (amount <= 0) throw new Error("Valor deve ser maior que zero.");
  await db.otherIncome.create({ data: { schoolId, category, amount, receivedAt: new Date(receivedAt), note: note?.trim() || null } });
  revalidatePath("/diretor");
}

export async function excluirOutraReceita(schoolId: string, id: string) {
  await requireDirector(schoolId);
  const registro = await db.otherIncome.findUniqueOrThrow({ where: { id } });
  if (registro.schoolId !== schoolId) throw new Error("Registro não pertence a esta escola.");
  await db.otherIncome.delete({ where: { id } });
  revalidatePath("/diretor");
}

export async function listarOutrasReceitas(schoolId: string, ano: number, mes: number) {
  await requireDirector(schoolId);
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMes = new Date(Date.UTC(ano, mes, 1));
  const registros = await db.otherIncome.findMany({
    where: { schoolId, receivedAt: { gte: inicioMes, lt: fimMes } },
    orderBy: { receivedAt: "desc" },
  });
  return registros.map((r) => ({ id: r.id, category: r.category, amount: Number(r.amount), receivedAt: r.receivedAt, note: r.note }));
}
