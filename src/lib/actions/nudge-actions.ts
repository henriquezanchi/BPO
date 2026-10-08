"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioCompositionAdd } from "@/lib/mercurio/sync-queue";
import { NUDGE_CATALOGO, type NudgeSuggestion } from "@/lib/nudge-catalog";
import { revalidatePath } from "next/cache";

/** Já tem esse crédito/doação ativo? Não oferece de novo. */
async function jaAtivo(memberId: string, sugestao: NudgeSuggestion): Promise<boolean> {
  if (sugestao.tipo === "fortuna") {
    const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { fortunaTopUpRecorrente: true } });
    return member.fortunaTopUpRecorrente !== null && Number(member.fortunaTopUpRecorrente) > 0;
  }
  const catalogo = await catalogoDoMembro(memberId, sugestao);
  if (!catalogo) return false;
  const item = await db.contributionCompositionItem.findUnique({
    where: { memberId_mercurioGroupId: { memberId, mercurioGroupId: catalogo.mercurioGroupId } },
  });
  return item !== null;
}

/** Acha o item real do catálogo da ESCOLA do membro que bate com o regex da sugestão. */
async function catalogoDoMembro(memberId: string, sugestao: NudgeSuggestion) {
  if (!sugestao.labelRegex) return null;
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { schoolId: true } });
  const itens = await db.schoolCompositionCatalogItem.findMany({ where: { schoolId: member.schoolId } });
  return itens.find((i) => sugestao.labelRegex!.test(i.label)) ?? null;
}

/**
 * Qual sugestão mostrar agora pro membro — só UMA de cada vez (pedido do
 * usuário: não ser inconveniente), pulando quem já está ativo, quem foi
 * recusado, e quem foi adiado pra depois de hoje.
 */
export async function getNudgeAtivo(memberId: string) {
  await requireAuthenticatedMember(memberId);

  const estados = await db.memberNudgeState.findMany({ where: { memberId } });
  const estadoPorId = new Map(estados.map((e) => [e.suggestionId, e]));
  const agora = new Date();

  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { fortunaClientId: true } });

  for (const sugestao of NUDGE_CATALOGO) {
    const estado = estadoPorId.get(sugestao.id);
    if (estado?.status === "recusado") continue;
    if (estado?.status === "adiado" && estado.snoozedUntil && estado.snoozedUntil > agora) continue;

    if (sugestao.tipo === "fortuna" && !member.fortunaClientId) continue; // sem Fortuna vinculado, não oferece
    if (sugestao.tipo === "composicao") {
      const catalogo = await catalogoDoMembro(memberId, sugestao);
      if (!catalogo) continue; // essa escola não tem esse item no catálogo — não oferece
    }
    if (await jaAtivo(memberId, sugestao)) continue;

    return { id: sugestao.id, titulo: sugestao.titulo, descricao: sugestao.descricao, opcoes: sugestao.opcoes };
  }
  return null;
}

/** 1º dia do mês seguinte, meio-dia UTC (mesma convenção de "data pura" do resto do projeto). */
function primeiroDiaDoProximoMes(ref: Date): Date {
  const ano = ref.getUTCFullYear();
  const mes = ref.getUTCMonth();
  return new Date(Date.UTC(mes === 11 ? ano + 1 : ano, mes === 11 ? 0 : mes + 1, 1, 12));
}

/**
 * Resposta do membro a uma sugestão: "sim" (aplica — crédito recorrente ou
 * inclusão de item, ambos direto, mesma regra de "qualquer aumento é
 * permitido" já usada em contribution-actions.ts), "depois" (some até o mês
 * que vem) ou "nao" (some pra sempre).
 */
export async function responderNudge(memberId: string, suggestionId: string, resposta: "sim" | "depois" | "nao", valor?: number) {
  await requireAuthenticatedMember(memberId);
  const sugestao = NUDGE_CATALOGO.find((s) => s.id === suggestionId);
  if (!sugestao) throw new Error("Sugestão desconhecida.");

  if (resposta === "depois") {
    await db.memberNudgeState.upsert({
      where: { memberId_suggestionId: { memberId, suggestionId } },
      update: { status: "adiado", snoozedUntil: primeiroDiaDoProximoMes(new Date()) },
      create: { memberId, suggestionId, status: "adiado", snoozedUntil: primeiroDiaDoProximoMes(new Date()) },
    });
    return { ok: true as const };
  }

  if (resposta === "nao") {
    await db.memberNudgeState.upsert({
      where: { memberId_suggestionId: { memberId, suggestionId } },
      update: { status: "recusado", snoozedUntil: null },
      create: { memberId, suggestionId, status: "recusado" },
    });
    return { ok: true as const };
  }

  // "sim"
  const opcao = sugestao.opcoes.find((o) => o.valor === valor) ?? sugestao.opcoes[0];

  if (sugestao.tipo === "fortuna") {
    await db.member.update({ where: { id: memberId }, data: { fortunaTopUpRecorrente: opcao.valor } });
  } else {
    const catalogo = await catalogoDoMembro(memberId, sugestao);
    if (!catalogo) throw new Error("Item de composição não encontrado no catálogo da escola.");
    await db.contributionCompositionItem.create({
      data: { memberId, mercurioGroupId: catalogo.mercurioGroupId, label: catalogo.label, amount: opcao.valor, addedViaPortal: true },
    });
    await db.compositionChangeRequest.create({
      data: { memberId, tipo: "inclusao", mercurioGroupId: catalogo.mercurioGroupId, label: catalogo.label, amount: opcao.valor, status: "aprovado", reviewedAt: new Date() },
    });
    await enqueueMercurioCompositionAdd(memberId, catalogo.mercurioGroupId, catalogo.label, opcao.valor);
  }

  // Não precisa gravar MemberNudgeState aqui — jaAtivo() já detecta que o
  // crédito/item existe de verdade e para de oferecer sozinho.
  revalidatePath("/portal");
  return { ok: true as const };
}
