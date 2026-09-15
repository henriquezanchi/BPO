"use server";

import { EMOJIS_PERMITIDOS } from "@/lib/agenda-reactions";
import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import type { AgendaItemType } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Alterna a reação do membro num item da Agenda (evento ou atividade) —
 * visível pros outros alunos (agregado por emoji, sem expor quem reagiu,
 * pra não virar rede social). Sem tempo real: outros alunos veem a
 * atualização quando reabrirem o Portal/a Agenda, não instantaneamente.
 */
export async function toggleAgendaReaction(memberId: string, itemType: AgendaItemType, itemId: string, emoji: string) {
  await requireAuthenticatedMember(memberId);
  if (!EMOJIS_PERMITIDOS.includes(emoji)) throw new Error("Emoji não permitido.");

  const existente = await db.agendaReaction.findUnique({
    where: { itemType_itemId_memberId_emoji: { itemType, itemId, memberId, emoji } },
  });

  if (existente) {
    await db.agendaReaction.delete({ where: { id: existente.id } });
  } else {
    await db.agendaReaction.create({ data: { itemType, itemId, memberId, emoji } });
  }

  const contagens = await db.agendaReaction.groupBy({
    by: ["emoji"],
    where: { itemType, itemId },
    _count: { emoji: true },
  });

  revalidatePath("/portal");

  return {
    reactedByMe: !existente,
    counts: Object.fromEntries(contagens.map((c) => [c.emoji, c._count.emoji])) as Record<string, number>,
  };
}
