"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioCompositionAdd, enqueueMercurioCompositionEdit, enqueueMercurioCompositionRemove } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

/**
 * Quantos dias ÚTEIS (seg-sex, sem feriados) se passaram ESTRITAMENTE depois
 * do dia de "desde" até o dia de "ate" (ambos considerados na data, não na
 * hora). Ex: inclusão numa sexta, hoje é segunda seguinte -> 1 dia útil
 * (só a própria segunda conta; sábado/domingo não contam).
 */
function diasUteisDecorridos(desde: Date, ate: Date): number {
  const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  const fim = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), ate.getUTCDate()));
  let dias = 0;
  while (cursor < fim) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const diaSemana = cursor.getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
}

function mesmoDiaUTC(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

/**
 * Inclui um item novo (categoria escolhida pelo membro, do catálogo já
 * sincronizado da escola — ver scripts/sync-composition.ts), com o valor que
 * o próprio membro escolheu.
 *
 * Regra do usuário 2026-10-08, generalizada a partir da exceção de doação:
 * qualquer inclusão SÓ AUMENTA o quanto o membro paga à escola — "a crédito
 * da escola" — então aplica direto, sem precisar de aprovação da Economia.
 * (A trava de aprovação continua existindo só pro lado que DIMINUI o que a
 * escola recebe — ver removeContributionItem.)
 *
 * Mesmo aplicando direto, grava um CompositionChangeRequest com
 * status "aprovado" (não "pendente") — vira o registro histórico usado pro
 * relatório de "quanto a contribuição cresceu" (ver
 * getCrescimentoComposicao em economia-actions.ts).
 */
export async function solicitarItemComposicao(memberId: string, mercurioGroupId: string, label: string, valor: number) {
  await requireAuthenticatedMember(memberId);

  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false as const, error: "Valor inválido." };
  }

  const item = await db.contributionCompositionItem.create({
    data: { memberId, mercurioGroupId, label, amount: valor, addedViaPortal: true },
  });
  await db.compositionChangeRequest.create({
    data: { memberId, tipo: "inclusao", mercurioGroupId, label, amount: valor, status: "aprovado", reviewedAt: new Date() },
  });
  await enqueueMercurioCompositionAdd(memberId, mercurioGroupId, label, valor);
  revalidatePath("/portal");
  return { ok: true as const, aplicadoDireto: true as const, item: { ...item, amount: Number(item.amount), pendingSync: true } };
}

/** Pra UI mostrar as solicitações do próprio membro ainda não revisadas (inclusão E remoção). */
export async function getSolicitacoesComposicaoDoMembro(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const pendentes = await db.compositionChangeRequest.findMany({
    where: { memberId, status: "pendente" },
    orderBy: { createdAt: "desc" },
  });
  return pendentes.map((p) => ({
    id: p.id,
    tipo: p.tipo as "inclusao" | "remocao",
    compositionItemId: p.compositionItemId,
    label: p.label,
    amount: Number(p.amount),
    createdAt: p.createdAt,
  }));
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

const DIAS_UTEIS_MINIMOS_PARA_REMOVER = 3;

/**
 * Remove um item. Duas situações bem diferentes (pedido do usuário
 * 2026-10-08):
 *
 * 1) Item que o PRÓPRIO membro incluiu pelo Portal (addedViaPortal) — self-
 *    service, MAS com janela de segurança: no mesmo dia da inclusão ainda
 *    não sensibilizou o Mercúrio, então remove na hora; depois do mesmo dia,
 *    só libera de novo depois de 3 dias úteis (tempo de sobra pra qualquer
 *    cobrança gerada nesse meio-tempo aparecer e ser tratada à parte) — no
 *    meio do caminho (dia 1 até o 3º dia útil) fica bloqueado de propósito.
 *
 * 2) Item que a ESCOLA lançou direto no Mercúrio (!addedViaPortal) — nunca
 *    foi self-service, mas antes simplesmente não tinha caminho nenhum. Agora
 *    vira uma SOLICITAÇÃO de remoção (CompositionChangeRequest, tipo
 *    "remocao"), que só o Secretário de Economia aprova — mesma fila da
 *    inclusão, só que pra tirar em vez de incluir.
 */
export async function removeContributionItem(memberId: string, compositionItemId: string) {
  await requireAuthenticatedMember(memberId);

  const item = await db.contributionCompositionItem.findUniqueOrThrow({ where: { id: compositionItemId } });
  if (item.memberId !== memberId) throw new Error("Este item não pertence a este membro.");

  if (!item.addedViaPortal) {
    const jaTemPedido = await db.compositionChangeRequest.findFirst({
      where: { compositionItemId, status: "pendente", tipo: "remocao" },
    });
    if (jaTemPedido) return { ok: false as const, error: "Já existe uma solicitação de remoção deste item aguardando aprovação." };

    await db.compositionChangeRequest.create({
      data: {
        memberId,
        tipo: "remocao",
        compositionItemId: item.id,
        mercurioGroupId: item.mercurioGroupId,
        label: item.label,
        amount: item.amount,
      },
    });
    revalidatePath("/portal");
    return { ok: true as const, solicitado: true as const };
  }

  const agora = new Date();
  if (!mesmoDiaUTC(item.createdAt, agora) && diasUteisDecorridos(item.createdAt, agora) < DIAS_UTEIS_MINIMOS_PARA_REMOVER) {
    return {
      ok: false as const,
      error: `Esse item já foi sincronizado com o Mercúrio — só dá pra remover no mesmo dia da inclusão ou depois de ${DIAS_UTEIS_MINIMOS_PARA_REMOVER} dias úteis (garante que nenhuma cobrança gerada nesse meio-tempo fique sem tratamento).`,
    };
  }

  await db.contributionCompositionItem.delete({ where: { id: compositionItemId } });
  await db.compositionChangeRequest.create({
    data: {
      memberId,
      tipo: "remocao",
      mercurioGroupId: item.mercurioGroupId,
      label: item.label,
      amount: item.amount,
      status: "aprovado",
      reviewedAt: agora,
    },
  });
  await enqueueMercurioCompositionRemove(memberId, item.mercurioGroupId);

  revalidatePath("/portal");
  return { ok: true as const, pending: true as const };
}
