"use server";

import { db } from "@/lib/db";
import { enqueueMercurioContactUpdate } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

export interface ContactChangeInput {
  whatsapp?: string;
  email?: string;
  address?: string;
}

const OVERDUE_STATUSES = new Set(["atrasado", "negociando"]);

/**
 * Atualiza os dados de contato do membro a partir do Portal.
 *
 * Regra de negócio: se o membro estiver com contribuição em atraso no
 * momento da alteração, gera um alerta para a secretaria de economia com o
 * antes/depois dos dados — pedido explícito para evitar que inadimplentes
 * troquem contato "por baixo do pano" sem a economia perceber.
 *
 * Também enfileira a mudança para propagação ao Mercúrio (ver
 * src/lib/mercurio/sync-queue.ts) — o Mercúrio segue sendo a fonte de
 * verdade cadastral da escola.
 */
export async function updateMemberContact(memberId: string, changes: ContactChangeInput) {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  const fields = ["whatsapp", "email", "address"] as const;
  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  for (const field of fields) {
    const incoming = changes[field];
    const current = member[field] ?? null;
    if (incoming !== undefined && incoming !== current) {
      oldValues[field] = current;
      newValues[field] = incoming;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { changed: false, alerted: false };
  }

  const wasOverdue = OVERDUE_STATUSES.has(member.status);

  await db.$transaction([
    db.member.update({ where: { id: memberId }, data: newValues }),
    db.contactChangeLog.create({
      data: {
        memberId,
        oldValues,
        newValues,
        memberWasOverdue: wasOverdue,
        alertedEconomia: wasOverdue,
      },
    }),
  ]);

  await enqueueMercurioContactUpdate(memberId, newValues);

  revalidatePath("/portal");

  return { changed: true, alerted: wasOverdue };
}
