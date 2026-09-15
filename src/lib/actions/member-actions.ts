"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioContactUpdate, processMercurioSyncQueue } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

export interface ContactChangeInput {
  whatsapp?: string;
  email?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

const CAMPOS_EDITAVEIS = [
  "whatsapp",
  "email",
  "addressStreet",
  "addressNumber",
  "addressComplement",
  "addressNeighborhood",
  "addressCity",
  "addressState",
  "addressZip",
] as const;

const OVERDUE_STATUSES = new Set(["atrasado", "negociando"]);

/**
 * Atualiza os dados de contato do membro a partir do Portal.
 *
 * Regra de negócio: se o membro estiver com contribuição em atraso no
 * momento da alteração, gera um alerta para a secretaria de economia com o
 * antes/depois dos dados — pedido explícito para evitar que inadimplentes
 * troquem contato "por baixo do pano" sem a economia perceber.
 *
 * Também propaga a mudança pro Mercúrio (fonte de verdade cadastral da
 * escola): enfileira em MercurioSyncTask (histórico/retry) e processa a
 * fila na hora (ver nota de escala em mercurio/sync-queue.ts) — o aluno vê
 * na mesma tela se a escrita no Mercúrio deu certo.
 *
 * requireAuthenticatedMember confere que quem está logado É o memberId
 * recebido — Server Actions não passam pelo matcher do proxy.ts, então sem
 * isso qualquer um poderia chamar a action com o id de outra pessoa.
 */
export async function updateMemberContact(memberId: string, changes: ContactChangeInput) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  for (const field of CAMPOS_EDITAVEIS) {
    const incoming = changes[field];
    const current = member[field] ?? null;
    if (incoming !== undefined && incoming !== current) {
      oldValues[field] = current;
      newValues[field] = incoming;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { changed: false, alerted: false, mercurioSynced: false };
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

  // Processa a fila na hora pra dar feedback imediato no Portal. Uma falha
  // aqui (ex: Mercúrio fora do ar, trava de concorrência ativa) não deve
  // impedir o salvamento local — a tarefa já está na fila e será
  // retentada; só reportamos que a sincronização não confirmou ainda.
  let mercurioSynced = false;
  try {
    const resultados = await processMercurioSyncQueue();
    mercurioSynced = resultados.some((r) => r.memberId === memberId && r.status === "sincronizado");
  } catch (e) {
    console.error("Falha ao processar fila de sincronização com o Mercúrio:", e);
  }

  revalidatePath("/portal");

  return { changed: true, alerted: wasOverdue, mercurioSynced };
}
