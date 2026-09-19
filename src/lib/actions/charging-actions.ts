"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import type { ChargeTriggerType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createChargingRule(schoolId: string, name: string) {
  await requireDirector(schoolId);
  if (!name.trim()) throw new Error("Nome da régua não pode ser vazio.");
  await db.chargingRule.create({ data: { schoolId, name: name.trim() } });
  revalidatePath("/diretor");
}

export async function createChargeTrigger(schoolId: string, chargingRuleId: string, type: ChargeTriggerType, messageTemplate: string) {
  await requireDirector(schoolId);
  const rule = await db.chargingRule.findUniqueOrThrow({ where: { id: chargingRuleId } });
  if (rule.schoolId !== schoolId) throw new Error("Régua não pertence a esta escola.");
  if (!messageTemplate.trim()) throw new Error("Modelo de mensagem não pode ser vazio.");

  await db.chargeTrigger.create({ data: { chargingRuleId, type, messageTemplate: messageTemplate.trim() } });
  revalidatePath("/diretor");
}

export async function toggleChargeTrigger(schoolId: string, triggerId: string, active: boolean) {
  await requireDirector(schoolId);
  const trigger = await db.chargeTrigger.findUniqueOrThrow({ where: { id: triggerId }, include: { chargingRule: true } });
  if (trigger.chargingRule.schoolId !== schoolId) throw new Error("Gatilho não pertence a esta escola.");
  await db.chargeTrigger.update({ where: { id: triggerId }, data: { active } });
  revalidatePath("/diretor");
}

function renderizarTemplate(template: string, member: { name: string }, valores: { valor: number; valorAtraso: number; mesesAtraso: number }) {
  return template
    .replaceAll("{{nome}}", member.name)
    .replaceAll("{{valor}}", valores.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
    .replaceAll("{{valorAtraso}}", valores.valorAtraso.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
    .replaceAll("{{mesesAtraso}}", String(valores.mesesAtraso));
}

/**
 * Gera (idempotente, via @@unique([memberId, chargeTriggerId, cycleKey]))
 * um rascunho de cobrança por membro x gatilho ativo da escola, pendente
 * de aprovação manual — decisão explícita do usuário: sem disparo
 * automático real por ora.
 *
 * Dois grupos de gatilho, avaliados de formas diferentes:
 * - "dia_10_desconto": DATA fixa (dia 10+ do mês), mira quem ainda NÃO
 *   pagou o mês atual (monthlyStatus do mês corrente = em_branco/ausente),
 *   independente de estar atrasado em meses anteriores — é lembrete de
 *   prazo de desconto, não cobrança de atraso.
 * - "inicio_mes"/"vencimento"/"fim_mes"/"atraso_30"/"atraso_60": heurística
 *   por CONTAGEM de meses em atraso (sem data exata de vencimento por mês
 *   em ContributionMonthlyStatus) — 1 mês bate com os 3 primeiros, 2+ com
 *   atraso_30, 3+ com atraso_60. Só avaliados pra quem já está
 *   atrasado/negociando.
 */
export async function gerarRascunhosDeCobranca(schoolId: string) {
  await requireDirector(schoolId);

  const rules = await db.chargingRule.findMany({ where: { schoolId }, include: { triggers: { where: { active: true } } } });
  const triggers = rules.flatMap((r) => r.triggers);
  if (triggers.length === 0) return { criados: 0 };

  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  const cycleKey = `${anoAtual}-${String(mesAtual).padStart(2, "0")}`;

  // "dia_10_desconto" precisa considerar TODO mundo ativo (mesmo quem está
  // em dia — o mês corrente pode ainda não ter sido pago); os outros
  // gatilhos são só pra quem já está atrasado/negociando. Se a escola tem
  // as duas famílias de gatilho ativas, não filtra por status (senão
  // perderíamos gente em dia que precisa do lembrete do dia 10).
  const soGatilhosDeAtraso = triggers.every((t) => t.type !== "dia_10_desconto");

  const membros = await db.member.findMany({
    where: {
      schoolId,
      mercurioAtivo: true,
      ...(soGatilhosDeAtraso ? { status: { in: ["atrasado", "negociando"] } } : {}),
    },
    include: {
      compositionItems: true,
      monthlyStatus: { where: { OR: [{ status: "atrasado" }, { year: anoAtual, month: mesAtual }] } },
    },
  });

  const existentes = new Set(
    (await db.chargeMessageDraft.findMany({ where: { cycleKey }, select: { memberId: true, chargeTriggerId: true } })).map(
      (d) => `${d.memberId}:${d.chargeTriggerId}`,
    ),
  );

  let criados = 0;
  for (const membro of membros) {
    const mesesAtraso = membro.monthlyStatus.filter((s) => s.status === "atrasado").length;
    const valor = membro.compositionItems.reduce((soma, i) => soma + Number(i.amount), 0);
    const valorAtraso = valor * mesesAtraso;
    const statusMesAtual = membro.monthlyStatus.find((s) => s.year === anoAtual && s.month === mesAtual)?.status ?? "em_branco";
    const aindaNaoPagouEsteMes = statusMesAtual === "em_branco" || statusMesAtual === "atrasado";

    for (const trigger of triggers) {
      const bate =
        (trigger.type === "dia_10_desconto" && agora.getDate() >= 10 && aindaNaoPagouEsteMes) ||
        (trigger.type === "atraso_60" && mesesAtraso >= 3) ||
        (trigger.type === "atraso_30" && mesesAtraso >= 2) ||
        (["inicio_mes", "vencimento", "fim_mes"].includes(trigger.type) && mesesAtraso >= 1);
      if (!bate) continue;
      if (existentes.has(`${membro.id}:${trigger.id}`)) continue;

      const body = renderizarTemplate(trigger.messageTemplate, membro, { valor, valorAtraso, mesesAtraso });
      await db.chargeMessageDraft.create({ data: { memberId: membro.id, chargeTriggerId: trigger.id, cycleKey, body } });
      criados++;
    }
  }

  revalidatePath("/diretor");
  return { criados };
}

export async function aprovarEEnviarRascunho(schoolId: string, draftId: string, bodyEditado?: string) {
  await requireDirector(schoolId);
  const draft = await db.chargeMessageDraft.findUniqueOrThrow({ where: { id: draftId }, include: { member: true } });
  if (draft.member.schoolId !== schoolId) throw new Error("Rascunho não pertence a esta escola.");
  if (draft.status !== "pendente_aprovacao") throw new Error("Este rascunho já foi decidido.");

  const corpoFinal = bodyEditado?.trim() || draft.body;
  await sendWhatsAppMessage(draft.member.whatsapp, corpoFinal);
  await db.chargeMessageDraft.update({ where: { id: draftId }, data: { status: "enviado", body: corpoFinal, decidedAt: new Date() } });
  revalidatePath("/diretor");
}

export async function descartarRascunho(schoolId: string, draftId: string) {
  await requireDirector(schoolId);
  const draft = await db.chargeMessageDraft.findUniqueOrThrow({ where: { id: draftId }, include: { member: true } });
  if (draft.member.schoolId !== schoolId) throw new Error("Rascunho não pertence a esta escola.");
  await db.chargeMessageDraft.update({ where: { id: draftId }, data: { status: "descartado", decidedAt: new Date() } });
  revalidatePath("/diretor");
}

export async function abrirNegociacao(schoolId: string, memberId: string, notes: string, promisedPaymentDate?: string) {
  await requireDirector(schoolId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.schoolId !== schoolId) throw new Error("Membro não pertence a esta escola.");

  await db.$transaction([
    db.crmContact.create({
      data: {
        memberId,
        channel: "whatsapp",
        notes: notes.trim(),
        promisedPaymentDate: promisedPaymentDate ? new Date(promisedPaymentDate) : null,
      },
    }),
    db.member.update({ where: { id: memberId }, data: { status: "negociando" } }),
  ]);
  revalidatePath("/diretor");
}

export async function resolverNegociacao(schoolId: string, crmContactId: string, novoStatus: "atrasado" | "em_dia") {
  await requireDirector(schoolId);
  const contato = await db.crmContact.findUniqueOrThrow({ where: { id: crmContactId }, include: { member: true } });
  if (contato.member.schoolId !== schoolId) throw new Error("Registro não pertence a esta escola.");

  await db.$transaction([
    db.crmContact.update({ where: { id: crmContactId }, data: { resolvedAt: new Date() } }),
    db.member.update({ where: { id: contato.memberId }, data: { status: novoStatus } }),
  ]);
  revalidatePath("/diretor");
}
