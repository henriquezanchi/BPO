"use server";

import { requireArea } from "@/lib/auth";
import { db } from "@/lib/db";
import { enviarWhatsappFinanceiro } from "@/lib/whatsapp/financeiro";
import { mesPorExtenso, nomeCurtoDaFilial, primeiroNome, reais, textoDoModelo, type NomeModelo } from "@/lib/whatsapp/modelos";
import type { ChargeTriggerType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createChargingRule(schoolId: string, name: string) {
  await requireArea(schoolId, "economia");
  if (!name.trim()) throw new Error("Nome da régua não pode ser vazio.");
  await db.chargingRule.create({ data: { schoolId, name: name.trim() } });
  revalidatePath("/", "layout");
}

export async function createChargeTrigger(schoolId: string, chargingRuleId: string, type: ChargeTriggerType) {
  await requireArea(schoolId, "economia");
  const rule = await db.chargingRule.findUniqueOrThrow({ where: { id: chargingRuleId } });
  if (rule.schoolId !== schoolId) throw new Error("Régua não pertence a esta escola.");
  // O texto é o modelo aprovado pela Meta para o gatilho (WhatsApp do financeiro, 2026-10-26); o campo guarda o nome dele.
  await db.chargeTrigger.create({ data: { chargingRuleId, type, messageTemplate: modeloDoGatilho(type) } });
  revalidatePath("/", "layout");
}

export async function toggleChargeTrigger(schoolId: string, triggerId: string, active: boolean) {
  await requireArea(schoolId, "economia");
  const trigger = await db.chargeTrigger.findUniqueOrThrow({ where: { id: triggerId }, include: { chargingRule: true } });
  if (trigger.chargingRule.schoolId !== schoolId) throw new Error("Gatilho não pertence a esta escola.");
  await db.chargeTrigger.update({ where: { id: triggerId }, data: { active } });
  revalidatePath("/", "layout");
}

/** Gatilho da régua → modelo do WhatsApp do financeiro: o do dia 10 é lembrete; os demais, contribuição em aberto. */
function modeloDoGatilho(type: ChargeTriggerType): NomeModelo {
  return type === "dia_10_desconto" ? "na_contribuicao_lembrete" : "na_contribuicao_em_aberto";
}

function parametrosDoGatilho(type: ChargeTriggerType, member: { name: string }, filial: string, valores: { valor: number; valorAtraso: number; mesesAtraso: number }, agora: Date) {
  if (modeloDoGatilho(type) === "na_contribuicao_lembrete") return [primeiroNome(member.name), filial, mesPorExtenso(agora.getFullYear(), agora.getMonth() + 1), reais(valores.valor)];
  return [primeiroNome(member.name), filial, valores.mesesAtraso === 1 ? "1 mês" : `${valores.mesesAtraso} meses`, reais(valores.valorAtraso)];
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
  await requireArea(schoolId, "economia");

  const rules = await db.chargingRule.findMany({ where: { schoolId }, include: { triggers: { where: { active: true } } } });
  const filial = nomeCurtoDaFilial((await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true } })).name);
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

      if ((trigger.type === "dia_10_desconto" ? valor : valorAtraso) <= 0) continue;
      const body = textoDoModelo(modeloDoGatilho(trigger.type), parametrosDoGatilho(trigger.type, membro, filial, { valor, valorAtraso, mesesAtraso }, agora));
      await db.chargeMessageDraft.create({ data: { memberId: membro.id, chargeTriggerId: trigger.id, cycleKey, body } });
      criados++;
    }
  }

  revalidatePath("/", "layout");
  return { criados };
}

/**
 * Envia o rascunho pelo WhatsApp do financeiro (número central, modelo aprovado pela Meta). O texto não é editável:
 * o WhatsApp só aceita o modelo aprovado. Valores recalculados na hora do envio.
 */
export async function aprovarEEnviarRascunho(schoolId: string, draftId: string) {
  await requireArea(schoolId, "economia");
  const r = await enviarRascunho(schoolId, draftId);
  revalidatePath("/", "layout");
  return r.status;
}

/** "Aprovar e enviar todos" da fila. Devolve quantos saíram e quantos ficaram de fora (sem celular, saiu da lista, falha). */
export async function aprovarEEnviarTodos(schoolId: string) {
  await requireArea(schoolId, "economia");
  const pendentes = await db.chargeMessageDraft.findMany({ where: { status: "pendente_aprovacao", member: { schoolId } }, select: { id: true } });
  let enviados = 0;
  let deFora = 0;
  for (const p of pendentes) {
    const r = await enviarRascunho(schoolId, p.id);
    if (r.status === "enviada" || r.status === "repetida") enviados++;
    else deFora++;
  }
  revalidatePath("/", "layout");
  return { enviados, deFora };
}

async function enviarRascunho(schoolId: string, draftId: string) {
  const draft = await db.chargeMessageDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { chargeTrigger: true, member: { include: { compositionItems: true, monthlyStatus: { where: { status: "atrasado" } }, school: { select: { name: true } } } } },
  });
  if (draft.member.schoolId !== schoolId) throw new Error("Rascunho não pertence a esta escola.");
  if (draft.status !== "pendente_aprovacao") throw new Error("Este rascunho já foi decidido.");

  const valor = draft.member.compositionItems.reduce((soma, i) => soma + Number(i.amount), 0);
  const mesesAtraso = draft.member.monthlyStatus.length;
  const type = draft.chargeTrigger.type;
  const modelo = modeloDoGatilho(type);
  const parametros = parametrosDoGatilho(type, draft.member, nomeCurtoDaFilial(draft.member.school.name), { valor, valorAtraso: valor * mesesAtraso, mesesAtraso }, new Date());
  const r = await enviarWhatsappFinanceiro({ schoolId, memberId: draft.memberId, telefone: draft.member.whatsapp, modelo, parametros, referencia: `regua:${draftId}` });
  if (r.status === "desligado") throw new Error("O WhatsApp do financeiro ainda não está ligado.");
  if (r.status === "falhou") return r;
  await db.chargeMessageDraft.update({
    where: { id: draftId },
    data: { status: r.status === "ignorada" ? "descartado" : "enviado", body: textoDoModelo(modelo, parametros), decidedAt: new Date() },
  });
  return r;
}

export async function descartarRascunho(schoolId: string, draftId: string) {
  await requireArea(schoolId, "economia");
  const draft = await db.chargeMessageDraft.findUniqueOrThrow({ where: { id: draftId }, include: { member: true } });
  if (draft.member.schoolId !== schoolId) throw new Error("Rascunho não pertence a esta escola.");
  await db.chargeMessageDraft.update({ where: { id: draftId }, data: { status: "descartado", decidedAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function abrirNegociacao(schoolId: string, memberId: string, notes: string, promisedPaymentDate?: string) {
  await requireArea(schoolId, "economia");
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
  revalidatePath("/", "layout");
}

export async function resolverNegociacao(schoolId: string, crmContactId: string, novoStatus: "atrasado" | "em_dia") {
  await requireArea(schoolId, "economia");
  const contato = await db.crmContact.findUniqueOrThrow({ where: { id: crmContactId }, include: { member: true } });
  if (contato.member.schoolId !== schoolId) throw new Error("Registro não pertence a esta escola.");

  await db.$transaction([
    db.crmContact.update({ where: { id: crmContactId }, data: { resolvedAt: new Date() } }),
    db.member.update({ where: { id: contato.memberId }, data: { status: novoStatus } }),
  ]);
  revalidatePath("/", "layout");
}
