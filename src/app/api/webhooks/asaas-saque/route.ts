import { db } from "@/lib/db";
import crypto from "node:crypto";

/**
 * Validação de saque via webhook do Asaas (Integrações → Segurança).
 * Pedido do usuário 2026-10-19: reembolsos de eventos sem o código por SMS.
 *
 * Cerca de 5 s depois de cada saída pedida pela API (inclusive nas
 * subcontas, quando habilitado na conta principal), o Asaas pergunta aqui se
 * a operação é legítima. Resposta: { status: "APPROVED" } ou
 * { status: "REFUSED", refuseReason }. Sem resposta válida 3 vezes, o
 * Asaas cancela a operação.
 *
 * Regra: o Portal só aprova o que ele mesmo pediu.
 *  - PIX_REFUND: aprova se há uma inscrição de evento cancelado com reembolso
 *    enviado pelo Portal nos últimos 60 minutos, do mesmo valor
 *    (event-refunds.ts marca refundSubmittedAt antes de chamar o Asaas).
 *  - PAYMENT_SPLIT: aprova (os splits são criados pelas cobranças do Portal).
 *  - Demais tipos (TRANSFER, BILL, PIX_QR_CODE, MOBILE_PHONE_RECHARGE):
 *    recusa, salvo os listados em ASAAS_SAQUE_OUTROS_APROVADOS (ex.: se outro
 *    sistema da mesma conta fizer transferências pela API).
 */
export const dynamic = "force-dynamic";

const JANELA_MS = 60 * 60 * 1000;

function iguais(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const responder = (aprovado: boolean, motivo?: string) =>
  Response.json(aprovado ? { status: "APPROVED" } : { status: "REFUSED", refuseReason: motivo ?? "Operação não solicitada pelo Portal." });

type Corpo = {
  type?: string;
  pixRefund?: { id?: string; value?: number; status?: string; originalTransaction?: Record<string, unknown> };
  paymentSplit?: { id?: string; value?: number };
};

export async function POST(req: Request) {
  const esperado = process.env.ASAAS_SAQUE_TOKEN;
  if (!esperado) return new Response("validation not configured", { status: 503 });
  if (!iguais(req.headers.get("asaas-access-token") ?? "", esperado)) return new Response("unauthorized", { status: 401 });

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return responder(false, "Requisição inválida.");
  }
  const tipo = corpo.type ?? "";

  if (tipo === "PIX_REFUND") {
    const r = corpo.pixRefund ?? {};
    const valor = Math.round(Number(r.value ?? 0) * 100);
    if (!r.id || !valor) return responder(false, "Estorno sem identificação ou valor.");
    // O Asaas pode repetir a pergunta: a mesma operação já aprovada continua aprovada.
    const jaAprovado = await db.eventAudit.findFirst({ where: { action: "reembolso_autorizado", changes: { path: ["pixRefundId"], equals: r.id } }, select: { id: true } });
    if (jaAprovado) return responder(true);
    const candidatas = await db.eventRegistration.findMany({
      where: {
        refundSubmittedAt: { gte: new Date(Date.now() - JANELA_MS) },
        refundState: { in: ["processando", "acompanhando", "revisao"] },
        asaasPaymentId: { not: null },
        event: { status: "cancelado", refundOnCancellation: true },
      },
      select: { id: true, eventId: true, amount: true, refundedAmount: true },
    });
    const usadas = new Set(
      (
        await db.eventAudit.findMany({
          where: { action: "reembolso_autorizado", createdAt: { gte: new Date(Date.now() - JANELA_MS) } },
          select: { changes: true },
        })
      ).map((a) => (a.changes as { registrationId?: string }).registrationId),
    );
    const alvo = candidatas.find((c) => !usadas.has(c.id) && Math.round((Number(c.amount ?? 0) - Number(c.refundedAmount ?? 0)) * 100) === valor);
    if (!alvo) {
      // Só tipo, valor e chaves do payload — nada de dados pessoais nos logs.
      console.warn("[Asaas saque] estorno recusado", { valor: valor / 100, chaves: Object.keys(r.originalTransaction ?? {}) });
      return responder(false, "Estorno não reconhecido pelo Portal.");
    }
    await db.eventAudit.create({ data: { eventId: alvo.eventId, actorId: "gateway", action: "reembolso_autorizado", changes: { registrationId: alvo.id, pixRefundId: r.id, valor: valor / 100 } } });
    return responder(true);
  }

  if (tipo === "PAYMENT_SPLIT") return responder(true);

  const outros = (process.env.ASAAS_SAQUE_OUTROS_APROVADOS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (outros.includes(tipo)) return responder(true);
  console.warn("[Asaas saque] operação recusada", { tipo });
  return responder(false);
}
