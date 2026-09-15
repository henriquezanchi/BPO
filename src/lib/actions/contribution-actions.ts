"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  enqueueMercurioCompositionAdd,
  enqueueMercurioCompositionEdit,
  enqueueMercurioCompositionRemove,
  processMercurioSyncQueue,
} from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

/**
 * Inclui um item novo (categoria escolhida pelo membro, do catálogo já
 * sincronizado da escola — ver scripts/sync-composition.ts). A escrita real
 * no Mercúrio passa pela mesma fila (MercurioSyncTask) usada pra
 * contato/dados pessoais, processada na hora pra dar feedback imediato —
 * mas se a trava de concorrência do Mercúrio estiver ativa (rodada
 * agendada em andamento), a tarefa fica pendente em vez de falhar de
 * verdade: o membro vê "solicitado, aplicando em breve" e a próxima
 * chamada à fila (de qualquer membro) resolve. Importante pra escala —
 * ver discussão de concorrência com múltiplas filiais/membros.
 */
export async function addContributionItem(memberId: string, mercurioGroupId: string, label: string) {
  await requireAuthenticatedMember(memberId);

  const task = await enqueueMercurioCompositionAdd(memberId, mercurioGroupId, label);
  await processMercurioSyncQueue();

  const atualizada = await db.mercurioSyncTask.findUniqueOrThrow({ where: { id: task.id } });
  if (atualizada.status === "falhou") {
    return { ok: false as const, error: atualizada.lastError ?? "Falha ao incluir no Mercúrio." };
  }
  if (atualizada.status === "pendente") {
    return { ok: false as const, pending: true as const, error: "Mercúrio ocupado agora — sua inclusão foi registrada e será aplicada em breve." };
  }

  const salvo = await db.contributionCompositionItem.findUniqueOrThrow({
    where: { memberId_mercurioGroupId: { memberId, mercurioGroupId } },
  });

  revalidatePath("/portal");
  return { ok: true as const, item: { ...salvo, amount: Number(salvo.amount) } };
}

/**
 * Altera o valor de um item — só permitido se o PRÓPRIO membro o incluiu
 * pelo Portal (addedViaPortal). Itens lançados pela tesouraria continuam
 * somente leitura, mesma regra de negócio do remove. Mesma fila/mesma
 * lógica de "pendente por concorrência" das outras ações de composição.
 */
export async function updateContributionItemValue(memberId: string, compositionItemId: string, novoValor: number) {
  await requireAuthenticatedMember(memberId);

  if (!Number.isFinite(novoValor) || novoValor < 0) {
    return { ok: false as const, error: "Valor inválido." };
  }

  const item = await db.contributionCompositionItem.findUniqueOrThrow({ where: { id: compositionItemId } });
  if (item.memberId !== memberId) throw new Error("Este item não pertence a este membro.");
  if (!item.addedViaPortal) {
    return { ok: false as const, error: "Este item foi lançado pela secretaria e não pode ser alterado pelo Portal." };
  }

  const task = await enqueueMercurioCompositionEdit(memberId, item.mercurioGroupId, novoValor);
  await processMercurioSyncQueue();

  const atualizada = await db.mercurioSyncTask.findUniqueOrThrow({ where: { id: task.id } });
  if (atualizada.status === "falhou") {
    return { ok: false as const, error: atualizada.lastError ?? "Falha ao alterar valor no Mercúrio." };
  }
  if (atualizada.status === "pendente") {
    return { ok: false as const, pending: true as const, error: "Mercúrio ocupado agora — sua alteração foi registrada e será aplicada em breve." };
  }

  const salvo = await db.contributionCompositionItem.findUniqueOrThrow({ where: { id: compositionItemId } });
  revalidatePath("/portal");
  return { ok: true as const, item: { ...salvo, amount: Number(salvo.amount) } };
}

/**
 * Remove um item — só permitido se o PRÓPRIO membro o incluiu pelo Portal
 * (addedViaPortal). Itens lançados pela tesouraria no Mercúrio são
 * somente leitura aqui, por regra de negócio explícita. Mesma fila/mesma
 * lógica de "pendente por concorrência" do addContributionItem.
 */
export async function removeContributionItem(memberId: string, compositionItemId: string) {
  await requireAuthenticatedMember(memberId);

  const item = await db.contributionCompositionItem.findUniqueOrThrow({ where: { id: compositionItemId } });
  if (item.memberId !== memberId) throw new Error("Este item não pertence a este membro.");
  if (!item.addedViaPortal) {
    return { ok: false as const, error: "Este item foi lançado pela secretaria e não pode ser removido pelo Portal." };
  }

  const task = await enqueueMercurioCompositionRemove(memberId, item.mercurioGroupId);
  await processMercurioSyncQueue();

  const atualizada = await db.mercurioSyncTask.findUniqueOrThrow({ where: { id: task.id } });
  if (atualizada.status === "falhou") {
    return { ok: false as const, error: atualizada.lastError ?? "Falha ao excluir no Mercúrio." };
  }
  if (atualizada.status === "pendente") {
    return { ok: false as const, pending: true as const, error: "Mercúrio ocupado agora — sua exclusão foi registrada e será aplicada em breve." };
  }

  revalidatePath("/portal");
  return { ok: true as const };
}
