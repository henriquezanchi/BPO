"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { fortunaCreditarSaldo, fortunaSearchClientsByName, type FortunaClient } from "@/lib/fortuna/client";
import { revalidatePath } from "next/cache";

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
