import { db } from "@/lib/db";
import { enqueueMercurioContributionLaunch } from "@/lib/mercurio/sync-queue";

/**
 * Marca uma cobrança como paga e dispara o resto (status mensal + fila de
 * lançamento no Mercúrio) — chamada tanto pelo polling (checkChargeStatus)
 * quanto pelo webhook do Asaas, que podem chegar quase juntos. O
 * `updateMany` com `where: status: "pendente"` só deixa QUEM CHEGOU
 * PRIMEIRO seguir adiante (count 0 = a outra chamada já processou) — sem
 * isso, os dois enfileirariam o lançamento no Mercúrio, duplicando um
 * recebimento real.
 */
export async function confirmarPagamento(chargeId: string): Promise<void> {
  const resultado = await db.paymentCharge.updateMany({
    where: { id: chargeId, status: "pendente" },
    data: { status: "pago", paidAt: new Date() },
  });
  if (resultado.count === 0) return;

  const charge = await db.paymentCharge.findUniqueOrThrow({ where: { id: chargeId } });

  await db.contributionMonthlyStatus.upsert({
    where: { memberId_year_month: { memberId: charge.memberId, year: charge.referenceYear, month: charge.referenceMonth } },
    update: { status: "paga", syncedAt: new Date() },
    create: { memberId: charge.memberId, year: charge.referenceYear, month: charge.referenceMonth, status: "paga" },
  });

  // Só enfileira — quem processa é o worker separado (scripts/process-
  // mercurio-queue.ts, agendado via Task Scheduler). Essa função é chamada
  // tanto pelo polling do aluno quanto pelo webhook do Asaas; nenhum dos
  // dois deveria esperar uma sessão de navegador inteira pra responder.
  await enqueueMercurioContributionLaunch(charge.memberId, charge.id);
}
