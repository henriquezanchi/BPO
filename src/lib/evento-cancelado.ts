/**
 * Evento cancelado (pedido do usuário 2026-10-25): continua no calendário de quem se inscreveu só até
 * o reembolso ser confirmado pela API do Asaas (rotina event-refunds, a cada 5 min) e, no máximo,
 * 5 dias depois do cancelamento (data do registro "cancelado" em EventAudit). Depois disso vai para o
 * fim da lista de "Meus eventos".
 */
export const PRAZO_EVENTO_CANCELADO_MS = 5 * 86_400_000;

export function canceladoAindaNoCalendario(canceladoEm: Date | null | undefined, refundState: string, agora = new Date()): boolean {
  if (refundState === "reembolsado" || !canceladoEm) return false;
  return agora.getTime() - canceladoEm.getTime() < PRAZO_EVENTO_CANCELADO_MS;
}
