import { db } from "@/lib/db";
import { fortunaCreditarSaldo, fortunaGetClient } from "@/lib/fortuna/client";
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

  // Recarga Fortuna combinada na mesma cobrança (ver payment-actions.ts) —
  // mesmo padrão best-effort do fluxo dedicado em fortuna-topup-actions.ts:
  // se falhar (membro desvinculado, API fora do ar), fica registrado em
  // fortunaTopUpError pra aparecer na fila de exceção do Painel do Diretor
  // em vez de se perder silenciosamente.
  if (charge.fortunaTopUpAmount && Number(charge.fortunaTopUpAmount) > 0) {
    try {
      const member = await db.member.findUniqueOrThrow({ where: { id: charge.memberId } });
      if (!member.fortunaClientId) throw new Error("Membro sem fortunaClientId vinculado.");
      const cliente = await fortunaGetClient(member.fortunaClientId);
      await fortunaCreditarSaldo(member.fortunaClientId, cliente.branch.id, Number(charge.fortunaTopUpAmount));
      await db.paymentCharge.update({ where: { id: charge.id }, data: { fortunaTopUpLaunchedAt: new Date() } });
    } catch (e) {
      await db.paymentCharge.update({ where: { id: charge.id }, data: { fortunaTopUpError: (e as Error).message } });
    }
  }
}
