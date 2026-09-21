"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Só marca o pedido — quem processa de verdade (abre sessão real do
 * Mercúrio, lê as Rubricas de Pagamento, atualiza SchoolPaymentRubrica) é
 * o worker (scripts/process-mercurio-queue.ts, já roda a cada 10min no
 * Railway). Precisou virar assíncrono pra rodar no Vercel (serverless não
 * tem Chromium/Playwright) — antes disso essa action abria a sessão do
 * Mercúrio direto, na hora.
 */
export async function sincronizarRubricasDePagamento(schoolId: string) {
  await requireDirector(schoolId);
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  if (!school.mercurioFilialLabel) throw new Error("Escola sem mercurioFilialLabel configurado.");
  if (!school.mercurioCaixaLancamento) {
    throw new Error("Escola sem caixa configurado (School.mercurioCaixaLancamento) — configure antes, ver scripts/list-cashiers.ts.");
  }

  await db.school.update({ where: { id: schoolId }, data: { rubricaSyncRequestedAt: new Date() } });
  revalidatePath("/diretor");
  return { pending: true as const };
}

/** Concilia (ou desfaz — rubricaId null) a categoria de uma conta contra o catálogo de rubricas — alteração e exclusão livres. */
export async function atribuirRubrica(schoolId: string, payableId: string, rubricaId: string | null) {
  await requireDirector(schoolId);
  const payable = await db.payable.findUniqueOrThrow({ where: { id: payableId } });
  if (payable.schoolId !== schoolId) throw new Error("Conta não pertence a esta escola.");

  if (rubricaId) {
    const rubrica = await db.schoolPaymentRubrica.findUniqueOrThrow({ where: { id: rubricaId } });
    if (rubrica.schoolId !== schoolId) throw new Error("Rubrica não pertence a esta escola.");
  }

  await db.payable.update({ where: { id: payableId }, data: { rubricaId } });
  revalidatePath("/diretor");
}
