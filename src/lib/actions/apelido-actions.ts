"use server";

import { validarApelido } from "@/lib/apelido";
import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/** "Como gosta de ser chamado" (24/11/2026): a pessoa define o próprio apelido; vazio apaga. */
export async function definirApelido(memberId: string, apelido: string): Promise<{ ok: true; apelido: string | null } | { ok: false; error: string }> {
  await requireAuthenticatedMember(memberId);
  const m = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { name: true } });
  try {
    const limpo = await validarApelido(String(apelido ?? "").slice(0, 80), m.name);
    await db.member.update({ where: { id: memberId }, data: { apelido: limpo } });
    revalidatePath("/portal");
    return { ok: true, apelido: limpo };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
