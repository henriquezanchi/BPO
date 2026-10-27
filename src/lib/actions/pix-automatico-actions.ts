"use server";

import { exigirEscritaMercurio } from "@/lib/mercurio-escrita";
import {
  asaasCancelPixAutomaticAuthorization,
  asaasCreatePixAutomaticAuthorization,
  asaasFindOrCreateCustomer,
  asaasGetPixAutomaticAuthorization,
} from "@/lib/asaas/client";
import { contaDaEscolaId, contaDeLeituraId, pixAutomaticoLiberado } from "@/lib/asaas/conta-escola";
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
  exigirEscritaMercurio(member);
  const unidade = (await db.school.findUnique({ where: { id: member.schoolId }, select: { mercurioUnidade: true } }))?.mercurioUnidade;
  if (!pixAutomaticoLiberado(unidade)) throw new Error("O débito automático ainda não está disponível na sua filial. Por enquanto, pague pelo Pix do mês.");

  const itens = await db.contributionCompositionItem.findMany({ where: { memberId } });
  const valor = itens.reduce((soma, i) => soma + Number(i.amount), 0);
  if (valor <= 0) throw new Error("Composição da contribuição está vazia — nada a cobrar.");

  // Sempre pela subconta da filial (regra do usuário 2026-10-25); a autorização fica presa a essa conta.
  const conta = await contaDaEscolaId(member.schoolId);
  const cliente = await asaasFindOrCreateCustomer(member.name, cpf, member.email ?? undefined, conta);
  const autorizacao = await asaasCreatePixAutomaticAuthorization(cliente.id, memberId, valor, `Contribuição mensal — ${member.name}`, conta);

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

  const autorizacao = await asaasGetPixAutomaticAuthorization(member.pixAutomaticAuthorizationId, await contaDeLeituraId(member.schoolId));
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

  await asaasCancelPixAutomaticAuthorization(member.pixAutomaticAuthorizationId, await contaDeLeituraId(member.schoolId)).catch(() => {});
  await db.member.update({ where: { id: memberId }, data: { pixAutomaticStatus: "CANCELLED" } });
}
