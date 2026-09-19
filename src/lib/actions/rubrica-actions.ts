"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { abrirSessaoMercurio, lerRubricasDePagamentoHoje } from "@/lib/mercurio/browser-session";
import { revalidatePath } from "next/cache";

/**
 * Sincroniza o catálogo de Rubricas de Pagamento ao vivo do Mercúrio
 * (Tesouraria > Caixa > dia > "Pagamento Outros") — mesmo catálogo usado
 * pra conciliar despesa importada de extrato bancário. Precisa de
 * School.mercurioFilialLabel e School.mercurioCaixaLancamento já
 * configurados (mesmo campo usado pro lançamento automático de
 * contribuição — ver scripts/list-cashiers.ts).
 */
export async function sincronizarRubricasDePagamento(schoolId: string) {
  await requireDirector(schoolId);
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  if (!school.mercurioFilialLabel) throw new Error("Escola sem mercurioFilialLabel configurado.");
  if (!school.mercurioCaixaLancamento) {
    throw new Error("Escola sem caixa configurado (School.mercurioCaixaLancamento) — configure antes, ver scripts/list-cashiers.ts.");
  }

  const { browser, page } = await abrirSessaoMercurio();
  let rubricas;
  try {
    rubricas = await lerRubricasDePagamentoHoje(page, new RegExp(school.mercurioFilialLabel, "i"), school.mercurioCaixaLancamento);
  } finally {
    await browser.close();
  }

  for (const r of rubricas) {
    await db.schoolPaymentRubrica.upsert({
      where: { schoolId_mercurioRubricaId: { schoolId, mercurioRubricaId: r.mercurioRubricaId } },
      update: { label: r.label, syncedAt: new Date() },
      create: { schoolId, mercurioRubricaId: r.mercurioRubricaId, label: r.label },
    });
  }

  revalidatePath("/diretor");
  return { total: rubricas.length };
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
