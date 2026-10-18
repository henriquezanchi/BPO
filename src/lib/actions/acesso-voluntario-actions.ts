"use server";

import { podeLiberar } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function liberarAcessoVoluntario(alvoId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await podeLiberar(eu, alvoId))) return { ok: false as const, error: "Você não pode liberar esta pessoa." };
  await db.acessoVoluntario.upsert({ where: { memberId: alvoId }, update: {}, create: { memberId: alvoId, liberadoPorId: eu.id } });
  revalidatePath("/voluntario/acessos");
  return { ok: true as const };
}

export async function revogarAcessoVoluntario(alvoId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await podeLiberar(eu, alvoId))) return { ok: false as const, error: "Você não pode alterar o acesso desta pessoa." };
  await db.acessoVoluntario.deleteMany({ where: { memberId: alvoId } });
  revalidatePath("/voluntario/acessos");
  return { ok: true as const };
}
