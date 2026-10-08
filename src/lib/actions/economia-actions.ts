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

function limitesDoMes(ano: number, mes: number) {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1));
  return { inicio, fim };
}

/**
 * Pedido do usuário 2026-10-08: mostrar pro Secretário de Economia (e pro
 * Diretor) o quanto a contribuição cresceu num mês, em duas frentes:
 * - "crescimentoComposicao": inclusões aprovadas menos remoções aprovadas de
 *   itens de composição (todo o histórico fica em CompositionChangeRequest,
 *   mesmo quando aplicado direto — ver contribution-actions.ts).
 * - "reversaoInadimplencia": soma de PaymentCharge PAGAS que foram criadas
 *   enquanto o membro estava "atrasado"/"negociando" (memberWasOverdue) —
 *   definição exata do usuário: "pagamentos recebidos de quem estava
 *   inadimplente na hora da cobrança". Agrupado pelo mês do PAGAMENTO
 *   (paidAt), não da criação da cobrança.
 */
export async function getCrescimentoContribuicoes(schoolId: string, ano: number, mes: number) {
  await requireEconomiaOuDirecao(schoolId);
  const { inicio, fim } = limitesDoMes(ano, mes);

  const [inclusoes, remocoes, reversoes] = await Promise.all([
    db.compositionChangeRequest.aggregate({
      where: { tipo: "inclusao", status: "aprovado", createdAt: { gte: inicio, lt: fim }, member: { schoolId } },
      _sum: { amount: true },
    }),
    db.compositionChangeRequest.aggregate({
      where: { tipo: "remocao", status: "aprovado", createdAt: { gte: inicio, lt: fim }, member: { schoolId } },
      _sum: { amount: true },
    }),
    db.paymentCharge.aggregate({
      where: { status: "pago", memberWasOverdue: true, paidAt: { gte: inicio, lt: fim }, member: { schoolId } },
      _sum: { amount: true },
    }),
  ]);

  return {
    ano,
    mes,
    crescimentoComposicao: Number(inclusoes._sum.amount ?? 0) - Number(remocoes._sum.amount ?? 0),
    reversaoInadimplencia: Number(reversoes._sum.amount ?? 0),
  };
}
