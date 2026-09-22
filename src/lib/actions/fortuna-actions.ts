"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { fortunaCreditarSaldo, fortunaGetClient, fortunaSearchClientsByName, type FortunaClient } from "@/lib/fortuna/client";
import { revalidatePath } from "next/cache";

export interface FortunaBalancesForDirector {
  saldoConsolidado: number;
  saldosPorMembro: { memberId: string; memberName: string; balance: number }[];
}

/**
 * Saldo Fortuna por membro vinculado — chamado client-side, FORA do
 * carregamento inicial de getDirectorDashboard (bug real medido ao vivo:
 * /diretor levando 7-9s porque essa busca rodava 1 chamada por membro,
 * em série, bloqueando a página inteira — mesmo problema já corrigido no
 * Portal do Membro, só que esquecido aqui). Paralelizado com Promise.all
 * (best-effort por membro, 1 falhar não derruba os outros).
 */
export async function getFortunaBalancesForDirector(schoolId: string): Promise<FortunaBalancesForDirector> {
  await requireDirector(schoolId);

  const vinculados = await db.member.findMany({ where: { schoolId, fortunaClientId: { not: null } } });

  const resultados = await Promise.all(
    vinculados.map(async (m) => {
      try {
        const cliente = await fortunaGetClient(m.fortunaClientId!);
        const balance = cliente.balance.reduce((soma, b) => soma + Number(b.amount), 0);
        return { memberId: m.id, memberName: m.name, balance };
      } catch {
        return null;
      }
    }),
  );

  const saldosPorMembro = resultados.filter((r) => r !== null);
  const saldoConsolidado = saldosPorMembro.reduce((soma, s) => soma + s.balance, 0);
  return { saldoConsolidado, saldosPorMembro };
}

/** Busca no Fortuna por nome — só pra RESOLVER manualmente qual fortunaClientId vincular (mesma cautela do script scripts/link-fortuna-clients.ts: confirmar por e-mail/telefone antes de vincular, nunca confiar só no nome). */
export async function buscarClientesFortunaPorNome(schoolId: string, nome: string): Promise<FortunaClient[]> {
  await requireDirector(schoolId);
  if (nome.trim().length < 3) return [];
  return fortunaSearchClientsByName(nome.trim());
}

export async function vincularMembroFortuna(schoolId: string, memberId: string, fortunaClientId: number) {
  await requireDirector(schoolId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.schoolId !== schoolId) throw new Error("Membro não pertence a esta escola.");

  await db.member.update({ where: { id: memberId }, data: { fortunaClientId } });
  revalidatePath("/diretor");
}

/**
 * Fila de EXCEÇÃO: o crédito automático (PUT /balance/with-receipt, ver
 * fortuna-topup-actions.ts) já roda sozinho assim que o PIX é confirmado —
 * essas duas actions só existem pro caso raro de falha (membro desvinculado,
 * API fora do ar etc.).
 */
export async function tentarNovamenteCreditoFortuna(schoolId: string, topUpChargeId: string) {
  await requireDirector(schoolId);
  const charge = await db.fortunaTopUpCharge.findUniqueOrThrow({ where: { id: topUpChargeId }, include: { member: true } });
  if (charge.member.schoolId !== schoolId) throw new Error("Recarga não pertence a esta escola.");
  if (charge.status !== "pago") throw new Error("Só é possível creditar uma recarga já paga.");
  if (!charge.member.fortunaClientId) throw new Error("Membro ainda sem vínculo com o Fortuna — vincule antes de tentar de novo.");

  await fortunaCreditarSaldo(charge.member.fortunaClientId, charge.branchId, Number(charge.amount));
  await db.fortunaTopUpCharge.update({
    where: { id: topUpChargeId },
    data: { launchedAt: new Date(), launchedBy: "Automático (nova tentativa)", autoCreditError: null },
  });
  revalidatePath("/diretor");
}

/** Marca como lançada manualmente (fallback final se a nova tentativa automática também falhar). `launchedBy` é texto livre. */
export async function marcarRecargaFortunaComoLancada(schoolId: string, topUpChargeId: string, launchedBy: string) {
  const director = await requireDirector(schoolId);
  const charge = await db.fortunaTopUpCharge.findUniqueOrThrow({ where: { id: topUpChargeId }, include: { member: true } });
  if (charge.member.schoolId !== schoolId) throw new Error("Recarga não pertence a esta escola.");
  if (charge.status !== "pago") throw new Error("Só é possível marcar como lançada uma recarga já paga.");

  await db.fortunaTopUpCharge.update({
    where: { id: topUpChargeId },
    data: { launchedAt: new Date(), launchedBy: launchedBy.trim() || director.name },
  });
  revalidatePath("/diretor");
}

/**
 * Mesma fila de exceção, só que pra recargas Fortuna combinadas numa
 * cobrança de CONTRIBUIÇÃO (ver payment-actions.ts createContributionCharge
 * e confirm-payment.ts) — tabela diferente (PaymentCharge, não
 * FortunaTopUpCharge), por isso ações próprias em vez de reaproveitar as
 * acima.
 */
export async function tentarNovamenteCreditoFortunaContribuicao(schoolId: string, chargeId: string) {
  await requireDirector(schoolId);
  const charge = await db.paymentCharge.findUniqueOrThrow({ where: { id: chargeId }, include: { member: true } });
  if (charge.member.schoolId !== schoolId) throw new Error("Cobrança não pertence a esta escola.");
  if (charge.status !== "pago" || !charge.fortunaTopUpAmount) throw new Error("Só é possível creditar uma recarga combinada já paga.");
  if (!charge.member.fortunaClientId) throw new Error("Membro ainda sem vínculo com o Fortuna — vincule antes de tentar de novo.");

  const cliente = await fortunaGetClient(charge.member.fortunaClientId);
  await fortunaCreditarSaldo(charge.member.fortunaClientId, cliente.branch.id, Number(charge.fortunaTopUpAmount));
  await db.paymentCharge.update({
    where: { id: chargeId },
    data: { fortunaTopUpLaunchedAt: new Date(), fortunaTopUpLaunchedBy: "Automático (nova tentativa)", fortunaTopUpError: null },
  });
  revalidatePath("/diretor");
}

export async function marcarRecargaContribuicaoFortunaComoLancada(schoolId: string, chargeId: string, launchedBy: string) {
  const director = await requireDirector(schoolId);
  const charge = await db.paymentCharge.findUniqueOrThrow({ where: { id: chargeId }, include: { member: true } });
  if (charge.member.schoolId !== schoolId) throw new Error("Cobrança não pertence a esta escola.");
  if (charge.status !== "pago" || !charge.fortunaTopUpAmount) throw new Error("Só é possível marcar como lançada uma recarga combinada já paga.");

  await db.paymentCharge.update({
    where: { id: chargeId },
    data: { fortunaTopUpLaunchedAt: new Date(), fortunaTopUpLaunchedBy: launchedBy.trim() || director.name },
  });
  revalidatePath("/diretor");
}
