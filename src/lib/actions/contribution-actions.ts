"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioCompositionAdd, enqueueMercurioCompositionEdit, enqueueMercurioCompositionRemove } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

/**
 * Inclui um item novo (categoria escolhida pelo membro, do catálogo já
 * sincronizado da escola — ver scripts/sync-composition.ts), com o valor
 * que o próprio membro escolheu (decisão do usuário 2026-09-21: melhor
 * pedir o valor ANTES de incluir do que deixar o item aparecer sem valor
 * definido). Escreve local já (mesmo padrão de updateContributionItemValue)
 * e só enfileira a propagação real pro Mercúrio — quem escreve de verdade
 * é o worker separado (scripts/process-mercurio-queue.ts), pra não travar a
 * navegação esperando uma sessão de navegador inteira.
 */
export async function addContributionItem(memberId: string, mercurioGroupId: string, label: string, valor: number) {
  await requireAuthenticatedMember(memberId);

  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false as const, error: "Valor inválido." };
  }

  const salvo = await db.contributionCompositionItem.create({
    data: { memberId, mercurioGroupId, label, amount: valor, addedViaPortal: true },
  });
  await enqueueMercurioCompositionAdd(memberId, mercurioGroupId, label, valor);
  revalidatePath("/portal");
  return { ok: true as const, pending: true as const, item: { ...salvo, amount: Number(salvo.amount), pendingSync: true } };
}

/**
 * Altera o valor de um item — só permitido se o PRÓPRIO membro o incluiu
 * pelo Portal (addedViaPortal). Diferente da inclusão: aqui o valor É
 * conhecido na hora (o membro digitou), então escreve local já (mesmo
 * padrão de updateMemberContact) e só enfileira a propagação real pro
 * Mercúrio.
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

  const salvo = await db.contributionCompositionItem.update({ where: { id: compositionItemId }, data: { amount: novoValor } });
  await enqueueMercurioCompositionEdit(memberId, item.mercurioGroupId, novoValor);

  revalidatePath("/portal");
  return { ok: true as const, pending: true as const, item: { ...salvo, amount: Number(salvo.amount), pendingSync: true } };
}

/**
 * Remove um item — só permitido se o PRÓPRIO membro o incluiu pelo Portal
 * (addedViaPortal). Remove local na hora (otimista) e só enfileira a
 * exclusão real no Mercúrio — mesmo motivo do updateContributionItemValue.
 */
export async function removeContributionItem(memberId: string, compositionItemId: string) {
  await requireAuthenticatedMember(memberId);

  const item = await db.contributionCompositionItem.findUniqueOrThrow({ where: { id: compositionItemId } });
  if (item.memberId !== memberId) throw new Error("Este item não pertence a este membro.");
  if (!item.addedViaPortal) {
    return { ok: false as const, error: "Este item foi lançado pela secretaria e não pode ser removido pelo Portal." };
  }

  await db.contributionCompositionItem.delete({ where: { id: compositionItemId } });
  await enqueueMercurioCompositionRemove(memberId, item.mercurioGroupId);

  revalidatePath("/portal");
  return { ok: true as const, pending: true as const };
}
