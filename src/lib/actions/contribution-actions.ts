"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioCompositionEdit, enqueueMercurioCompositionRemove } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

/**
 * Solicita a inclusão de um item novo (categoria escolhida pelo membro, do
 * catálogo já sincronizado da escola — ver scripts/sync-composition.ts),
 * com o valor que o próprio membro escolheu. Pedido do usuário 2026-10-08:
 * incluir item novo cria um compromisso financeiro que a escola ainda não
 * sabe que existe, então vira uma SOLICITAÇÃO (CompositionChangeRequest,
 * status "pendente") em vez de aplicar direto — só o Secretário de
 * Economia aprovando (ver economia-actions.ts) grava de verdade em
 * ContributionCompositionItem e propaga pro Mercúrio. Editar/remover um
 * item que o próprio membro já incluiu continua self-service (funções
 * abaixo, inalteradas) — baixo risco, já tem a trava de addedViaPortal.
 */
export async function solicitarItemComposicao(memberId: string, mercurioGroupId: string, label: string, valor: number) {
  await requireAuthenticatedMember(memberId);

  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false as const, error: "Valor inválido." };
  }

  const solicitacao = await db.compositionChangeRequest.create({
    data: { memberId, mercurioGroupId, label, amount: valor },
  });
  revalidatePath("/portal");
  return { ok: true as const, solicitado: true as const, id: solicitacao.id };
}

/** Pra UI mostrar as solicitações do próprio membro ainda não revisadas. */
export async function getSolicitacoesComposicaoDoMembro(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const pendentes = await db.compositionChangeRequest.findMany({
    where: { memberId, status: "pendente" },
    orderBy: { createdAt: "desc" },
  });
  return pendentes.map((p) => ({ id: p.id, label: p.label, amount: Number(p.amount), createdAt: p.createdAt }));
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
