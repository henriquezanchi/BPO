"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { fortunaSearchClientsByName, type FortunaClient } from "@/lib/fortuna/client";
import { revalidatePath } from "next/cache";

/** Busca no Fortuna por nome — só pra RESOLVER manualmente qual fortunaClientId vincular (mesma cautela do script scripts/link-fortuna-clients.ts: confirmar por e-mail/telefone antes de vincular, nunca confiar só no nome). */
export async function buscarClientesFortunaPorNome(schoolId: string, nome: string): Promise<FortunaClient[]> {
  await requireDirector(schoolId);
  if (nome.trim().length < 3) return [];
  return fortunaSearchClientsByName(nome.trim());
}

export async function vincularMembroFortuna(schoolId: string, memberId: string, fortunaClientId: number) {
  await requireDirector(schoolId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.schoolId !== schoolId) throw new Error("Membro não pertence a esta escola.");

  await db.member.update({ where: { id: memberId }, data: { fortunaClientId } });
  revalidatePath("/diretor");
}
