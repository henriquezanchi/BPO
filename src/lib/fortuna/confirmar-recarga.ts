import { asaasGetPaymentStatus } from "@/lib/asaas/client";
import { contaDeLeituraId } from "@/lib/asaas/conta-escola";
import { db } from "@/lib/db";
import { notificarErroSuporte } from "@/lib/error-notify";
import { fortunaCreditarSaldo } from "@/lib/fortuna/client";

/**
 * Confere no Asaas e, se paga, marca a recarga do Fortuna e credita o saldo (PUT /balance/with-receipt). Chamada pela
 * tela do aluno, pelo webhook do Asaas e pela rotina de conferência (26/10/2026: antes só a tela confirmava, e quem
 * fechasse a tela ficava sem o crédito). O `updateMany` com status "pendente" deixa só quem chegou primeiro creditar.
 * Falha no crédito deixa a recarga paga sem `launchedAt` (fila de exceção da FortunaTab) e avisa o suporte.
 */
export async function confirmarRecargaFortuna(chargeId: string): Promise<"pago" | "pendente"> {
  const charge = await db.fortunaTopUpCharge.findUniqueOrThrow({ where: { id: chargeId }, include: { member: { select: { schoolId: true, fortunaClientId: true } } } });
  if (charge.status === "pago") return "pago";
  if (charge.status !== "pendente") return "pendente";

  const pagamento = await asaasGetPaymentStatus(charge.asaasPaymentId, await contaDeLeituraId(charge.member.schoolId));
  if (pagamento.status !== "RECEIVED" && pagamento.status !== "CONFIRMED") return "pendente";

  const marcou = await db.fortunaTopUpCharge.updateMany({ where: { id: chargeId, status: "pendente" }, data: { status: "pago", paidAt: new Date() } });
  if (!marcou.count) return "pago";

  try {
    if (!charge.member.fortunaClientId) throw new Error("Membro sem fortunaClientId vinculado.");
    await fortunaCreditarSaldo(charge.member.fortunaClientId, charge.branchId, Number(charge.amount));
    await db.fortunaTopUpCharge.update({ where: { id: chargeId }, data: { launchedAt: new Date(), launchedBy: "Automático (Asaas → Fortuna)" } });
  } catch (e) {
    const message = (e as Error).message;
    await db.fortunaTopUpCharge.update({ where: { id: chargeId }, data: { autoCreditError: message } });
    await notificarErroSuporte({ message: `Falha ao creditar recarga Fortuna dedicada (charge ${chargeId}): ${message}`, path: "confirmarRecargaFortuna" });
  }
  return "pago";
}

/** Rotina: confere as recargas pendentes dos últimos 3 dias (cobre webhook perdido e tela fechada). */
export async function conferirRecargasPendentes() {
  const pendentes = await db.fortunaTopUpCharge.findMany({
    where: { status: "pendente", createdAt: { gte: new Date(Date.now() - 3 * 864e5) } },
    select: { id: true },
    take: 50,
  });
  let pagas = 0;
  for (const p of pendentes) if ((await confirmarRecargaFortuna(p.id).catch(() => "pendente")) === "pago") pagas++;
  return { conferidas: pendentes.length, pagas };
}
