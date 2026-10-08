"use server";

import { requireEconomiaOuDirecao } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioCompositionAdd, enqueueMercurioCompositionRemove } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

/** Solicitações de inclusão de item de composição (ver solicitarItemComposicao em contribution-actions.ts) pendentes de aprovação. */
export async function getSolicitacoesComposicaoPendentes(schoolId: string) {
  await requireEconomiaOuDirecao(schoolId);
  const solicitacoes = await db.compositionChangeRequest.findMany({
    where: { status: "pendente", member: { schoolId } },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  // amount vem como Decimal do Prisma — não serializa de Server Action pra
  // Client Component sem isso (mesmo motivo de SerializedCompositionItem).
  return solicitacoes.map((s) => ({ ...s, amount: Number(s.amount) }));
}

/**
 * Aprova — comportamento depende do tipo:
 * - "inclusao": cria o item de verdade (addedViaPortal) e enfileira a inclusão no Mercúrio.
 * - "remocao" (pedido do usuário 2026-10-08, item que a escola lançou direto
 *   no Mercúrio): apaga o item de verdade e enfileira a remoção no Mercúrio.
 */
export async function aprovarSolicitacaoComposicao(schoolId: string, requestId: string) {
  await requireEconomiaOuDirecao(schoolId);
  const solicitacao = await db.compositionChangeRequest.findUniqueOrThrow({ where: { id: requestId }, include: { member: true } });
  if (solicitacao.member.schoolId !== schoolId) throw new Error("Solicitação não pertence a esta escola.");
  if (solicitacao.status !== "pendente") throw new Error("Solicitação já foi revisada.");

  if (solicitacao.tipo === "remocao") {
    await db.$transaction([
      ...(solicitacao.compositionItemId ? [db.contributionCompositionItem.delete({ where: { id: solicitacao.compositionItemId } })] : []),
      db.compositionChangeRequest.update({ where: { id: requestId }, data: { status: "aprovado", reviewedAt: new Date() } }),
    ]);
    await enqueueMercurioCompositionRemove(solicitacao.memberId, solicitacao.mercurioGroupId);
  } else {
    const valor = Number(solicitacao.amount);
    await db.$transaction([
      db.contributionCompositionItem.upsert({
        where: { memberId_mercurioGroupId: { memberId: solicitacao.memberId, mercurioGroupId: solicitacao.mercurioGroupId } },
        update: { label: solicitacao.label, amount: valor, addedViaPortal: true },
        create: { memberId: solicitacao.memberId, mercurioGroupId: solicitacao.mercurioGroupId, label: solicitacao.label, amount: valor, addedViaPortal: true },
      }),
      db.compositionChangeRequest.update({ where: { id: requestId }, data: { status: "aprovado", reviewedAt: new Date() } }),
    ]);
    await enqueueMercurioCompositionAdd(solicitacao.memberId, solicitacao.mercurioGroupId, solicitacao.label, valor);
  }

  revalidatePath("/economia");
  revalidatePath("/portal");
}

/** Rejeita: nada é aplicado, só marca como revisado. */
export async function rejeitarSolicitacaoComposicao(schoolId: string, requestId: string) {
  await requireEconomiaOuDirecao(schoolId);
  const solicitacao = await db.compositionChangeRequest.findUniqueOrThrow({ where: { id: requestId }, include: { member: true } });
  if (solicitacao.member.schoolId !== schoolId) throw new Error("Solicitação não pertence a esta escola.");
  if (solicitacao.status !== "pendente") throw new Error("Solicitação já foi revisada.");

  await db.compositionChangeRequest.update({ where: { id: requestId }, data: { status: "rejeitado", reviewedAt: new Date() } });
  revalidatePath("/economia");
}
