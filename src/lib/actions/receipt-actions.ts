"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioReceiptFetch, processMercurioSyncQueue } from "@/lib/mercurio/sync-queue";

/**
 * Busca o conteúdo (documento) de um recibo específico do membro. Primeira
 * vez: enfileira e processa na hora (~poucos segundos, sessão real no
 * Mercúrio) — depois disso o conteúdo fica cacheado pra sempre em
 * ContributionReceipt.rawText (documento histórico imutável, só é
 * cancelado, nunca alterado), então visualizações futuras nem tocam o
 * Mercúrio de novo.
 */
export async function viewReceipt(memberId: string, receiptId: string) {
  await requireAuthenticatedMember(memberId);

  const receipt = await db.contributionReceipt.findUniqueOrThrow({ where: { id: receiptId } });
  if (receipt.memberId !== memberId) throw new Error("Este recibo não pertence a este membro.");

  if (receipt.rawText !== null && receipt.canceled !== null) {
    if (receipt.canceled) return { ok: false as const, error: "Este recibo foi cancelado depois de emitido." };
    return { ok: true as const, rawText: receipt.rawText };
  }

  const task = await enqueueMercurioReceiptFetch(memberId, receipt.mercurioRecId);
  await processMercurioSyncQueue();

  const atualizada = await db.mercurioSyncTask.findUniqueOrThrow({ where: { id: task.id } });
  if (atualizada.status === "falhou") {
    return { ok: false as const, error: atualizada.lastError ?? "Falha ao buscar o recibo no Mercúrio." };
  }
  if (atualizada.status === "pendente") {
    return { ok: false as const, pending: true as const, error: "Mercúrio ocupado agora — tente ver este recibo de novo em alguns minutos." };
  }

  const recarregado = await db.contributionReceipt.findUniqueOrThrow({ where: { id: receiptId } });
  if (recarregado.canceled) {
    return { ok: false as const, error: "Este recibo foi cancelado depois de emitido." };
  }
  return { ok: true as const, rawText: recarregado.rawText ?? "" };
}
