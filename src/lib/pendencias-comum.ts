/** Regras puras das pendências da Tesouraria do Mercúrio (26/11/2026), usadas no servidor e no navegador. */

/** Vencimento "MM/AAAA" já chegou (mês corrente ou anterior, no fuso de Brasília): o Mercúrio põe no próximo recibo. */
export function pendenciaVencida(p: { vencimento: string }, hoje = new Date()): boolean {
  const m = p.vencimento.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return true;
  const [mes, ano] = [Number(m[1]), Number(m[2])];
  const agora = new Date(hoje.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return ano < agora.getFullYear() || (ano === agora.getFullYear() && mes <= agora.getMonth() + 1);
}
