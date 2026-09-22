"use server";

import {
  asaasCancelPixAutomaticAuthorization,
  asaasCreatePixAutomaticAuthorization,
  asaasFindOrCreateCustomer,
  asaasGetPixAutomaticAuthorization,
} from "@/lib/asaas/client";
import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Ativa o Pix Automático (débito recorrente de verdade — ver
 * asaas/client.ts) pra este membro: aluno autoriza 1x (paga o QR code
 * abaixo, que já cobra a contribuição do mês corrente E autoriza os ciclos
 * seguintes), e a partir daí o worker mensal (ver processarDebitosAutomaticos
 * em scripts/sync-monthly-status.ts) cobra sozinho todo mês, sem o aluno
 * precisar abrir o Portal de novo — decisão do usuário 2026-09-22: vira o
 * padrão SUGERIDO (oferecido ativamente após o 1º pagamento manual).
 */
export async function ativarPixAutomatico(memberId: string, cpf: string) {
  const member = await requireAuthenticatedMember(memberId);

  const itens = await db.contributionCompositionItem.findMany({ where: { memberId } });
  const valor = itens.reduce((soma, i) => soma + Number(i.amount), 0);
  if (valor <= 0) throw new Error("Composição da contribuição está vazia — nada a cobrar.");

  const cliente = await asaasFindOrCreateCustomer(member.name, cpf, member.email ?? undefined);
  const autorizacao = await asaasCreatePixAutomaticAuthorization(cliente.id, memberId, valor, `Contribuição mensal — ${member.name}`);

  await db.member.update({
    where: { id: memberId },
    data: {
      asaasCustomerId: cliente.id,
      pixAutomaticAuthorizationId: autorizacao.id,
      pixAutomaticStatus: autorizacao.status,
    },
  });

  return { authorizationId: autorizacao.id, payload: autorizacao.payload, encodedImage: autorizacao.encodedImage, amount: valor };
}

/** Confere o status real (fallback do webhook, mesmo padrão de checkChargeStatus) — retorna o status atualizado. */
export async function checkPixAutomaticoStatus(memberId: string) {
  const member = await requireAuthenticatedMember(memberId);
  if (!member.pixAutomaticAuthorizationId) return { status: null };
  if (member.pixAutomaticStatus === "ACTIVE") return { status: "ACTIVE" as const };

  const autorizacao = await asaasGetPixAutomaticAuthorization(member.pixAutomaticAuthorizationId);
  if (autorizacao.status !== member.pixAutomaticStatus) {
    await db.member.update({
      where: { id: memberId },
      data: { pixAutomaticStatus: autorizacao.status, pixAutomaticActivatedAt: autorizacao.status === "ACTIVE" ? new Date() : undefined },
    });
  }
  return { status: autorizacao.status };
}

/** Desliga o débito automático — aluno volta a precisar pagar manualmente todo mês. */
export async function desativarPixAutomatico(memberId: string) {
  const member = await requireAuthenticatedMember(memberId);
  if (!member.pixAutomaticAuthorizationId) return;

  await asaasCancelPixAutomaticAuthorization(member.pixAutomaticAuthorizationId).catch(() => {});
  await db.member.update({ where: { id: memberId }, data: { pixAutomaticStatus: "CANCELLED" } });
}
