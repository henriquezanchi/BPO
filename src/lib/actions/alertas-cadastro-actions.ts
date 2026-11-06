"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { db } from "@/lib/db";
import { chaveCorrigidos, lerCorrigidos } from "@/lib/alertas/corrigidos";

/** "Já corrigi no Mercúrio": esconde o item até o próximo resumo da filial (ver lib/alertas/corrigidos.ts). */
export async function marcarAlertaCorrigido(schoolId: string, chave: string) {
  await requireArea(schoolId, "escolastica");
  if (typeof chave !== "string" || chave.length > 200) throw new Error("Item inválido.");
  const limite = Date.now() - 14 * 864e5;
  const itens = (await lerCorrigidos(schoolId)).filter((c) => c.chave !== chave && new Date(c.em).getTime() > limite);
  itens.push({ chave, em: new Date().toISOString() });
  await db.resumoNacional.upsert({
    where: { chave: chaveCorrigidos(schoolId) },
    update: { dados: { itens }, geradoEm: new Date() },
    create: { chave: chaveCorrigidos(schoolId), dados: { itens } },
  });
  revalidatePath("/escolastica");
}
