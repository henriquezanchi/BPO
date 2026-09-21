"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioReceiptFetch } from "@/lib/mercurio/sync-queue";

/**
 * Busca o conteúdo (documento) de um recibo específico do membro. Primeira
 * vez: só enfileira — quem processa de verdade (sessão real no Mercúrio) é
 * o worker (scripts/process-mercurio-queue.ts, já roda a cada 10min no
 * Railway), não mais esta action (precisou virar assíncrono pra rodar no
 * Vercel, que não tem Chromium/Playwright em serverless). Depois de
 * processado, o conteúdo fica cacheado pra sempre em
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

/**
 * Mesmo fluxo do viewReceipt, mas a partir do mercurioRecId — usado pela
 * tela "Situação da Contribuição" (Ficha Anual), que conhece o
 * mercurioRecId de cada mês pago (ContributionMonthlyStatus.mercurioRecId)
 * mas pode não ter ainda um ContributionReceipt local (só sincronizamos
 * poucos meses via scripts/sync-receipts.ts) — cria o registro na hora se
 * preciso, com dados provisórios que o próximo sync-receipts.ts corrige.
 */
export async function viewReceiptByMercurioRecId(memberId: string, mercurioRecId: string) {
  await requireAuthenticatedMember(memberId);

  let receipt = await db.contributionReceipt.findUnique({ where: { mercurioRecId } });
  if (receipt && receipt.memberId !== memberId) throw new Error("Este recibo não pertence a este membro.");
  if (!receipt) {
    receipt = await db.contributionReceipt.create({ data: { memberId, mercurioRecId, issuedAt: new Date(), amount: 0 } });
  }

  return viewReceipt(memberId, receipt.id);
}
