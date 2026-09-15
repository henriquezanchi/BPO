"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { mercurioAdapter } from "@/lib/mercurio";
import { revalidatePath } from "next/cache";

async function identidadeMercurio(memberId: string) {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, include: { school: true } });
  if (!member.mercurioId) throw new Error("Membro sem matrícula do Mercúrio vinculada.");
  if (!member.school.mercurioFilialLabel) throw new Error(`Escola "${member.school.name}" sem mercurioFilialLabel configurado.`);
  return { matricula: member.mercurioId, name: member.name, filialLabel: member.school.mercurioFilialLabel };
}

/**
 * Puxa a composição real do Mercúrio (leitura ao vivo, ~5-10s — sessão de
 * navegador de verdade) e sincroniza com o banco local: itens que já
 * existiam localmente como "addedViaPortal" continuam marcados assim;
 * qualquer item vindo do Mercúrio é gravado/atualizado como NÃO
 * addedViaPortal (fonte de verdade é sempre o Mercúrio pra esse flag,
 * exceto quando o próprio addCompositionItem acabou de criar um).
 * Devolve também o catálogo de itens disponíveis pra incluir.
 */
export async function refreshMemberComposition(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const identidade = await identidadeMercurio(memberId);

  const { items, availableToAdd } = await mercurioAdapter.pullComposition(identidade);

  const existentes = await db.contributionCompositionItem.findMany({ where: { memberId } });
  const existentesPorGrupo = new Map(existentes.map((e) => [e.mercurioGroupId, e]));
  const gruposAtuais = new Set(items.map((i) => i.mercurioGroupId));

  await db.$transaction([
    ...items.map((item) =>
      db.contributionCompositionItem.upsert({
        where: { memberId_mercurioGroupId: { memberId, mercurioGroupId: item.mercurioGroupId } },
        update: { label: item.label, amount: item.amount },
        create: {
          memberId,
          mercurioGroupId: item.mercurioGroupId,
          label: item.label,
          amount: item.amount,
          addedViaPortal: existentesPorGrupo.get(item.mercurioGroupId)?.addedViaPortal ?? false,
        },
      }),
    ),
    // Itens que sumiram do Mercúrio (excluídos por lá, fora do Portal) não fazem mais sentido localmente.
    db.contributionCompositionItem.deleteMany({
      where: { memberId, mercurioGroupId: { notIn: [...gruposAtuais] } },
    }),
  ]);

  const itensLocais = await db.contributionCompositionItem.findMany({ where: { memberId }, orderBy: { createdAt: "asc" } });

  revalidatePath("/portal");

  return {
    availableToAdd,
    items: itensLocais.map((i) => ({ ...i, amount: Number(i.amount) })),
  };
}

/** Inclui um item novo (categoria escolhida pelo membro) — grava direto no Mercúrio, marcado como incluído pelo Portal. */
export async function addContributionItem(memberId: string, mercurioGroupId: string, label: string) {
  await requireAuthenticatedMember(memberId);
  const identidade = await identidadeMercurio(memberId);

  const result = await mercurioAdapter.addCompositionItem(identidade, mercurioGroupId);
  if (!result.ok) return { ok: false as const, error: result.error ?? "Falha ao incluir no Mercúrio." };

  // Relê a composição pra pegar o valor padrão que o Mercúrio aplicou pro
  // item — não é escolhido pelo Portal, vem do catálogo de lá.
  const { items } = await mercurioAdapter.pullComposition(identidade);
  const itemIncluido = items.find((i) => i.mercurioGroupId === mercurioGroupId);

  const salvo = await db.contributionCompositionItem.upsert({
    where: { memberId_mercurioGroupId: { memberId, mercurioGroupId } },
    update: { label: itemIncluido?.label ?? label, amount: itemIncluido?.amount ?? 0, addedViaPortal: true },
    create: {
      memberId,
      mercurioGroupId,
      label: itemIncluido?.label ?? label,
      amount: itemIncluido?.amount ?? 0,
      addedViaPortal: true,
    },
  });

  revalidatePath("/portal");
  return { ok: true as const, item: { ...salvo, amount: Number(salvo.amount) } };
}

/**
 * Remove um item — só permitido se o PRÓPRIO membro o incluiu pelo Portal
 * (addedViaPortal). Itens lançados pela tesouraria no Mercúrio são
 * somente leitura aqui, por regra de negócio explícita.
 */
export async function removeContributionItem(memberId: string, compositionItemId: string) {
  await requireAuthenticatedMember(memberId);

  const item = await db.contributionCompositionItem.findUniqueOrThrow({ where: { id: compositionItemId } });
  if (item.memberId !== memberId) throw new Error("Este item não pertence a este membro.");
  if (!item.addedViaPortal) {
    return { ok: false as const, error: "Este item foi lançado pela secretaria e não pode ser removido pelo Portal." };
  }

  const identidade = await identidadeMercurio(memberId);
  const result = await mercurioAdapter.removeCompositionItem(identidade, item.mercurioGroupId);
  if (!result.ok) return { ok: false as const, error: result.error ?? "Falha ao excluir no Mercúrio." };

  await db.contributionCompositionItem.delete({ where: { id: compositionItemId } });
  revalidatePath("/portal");
  return { ok: true };
}
