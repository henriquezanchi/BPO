/**
 * Regra da situação da contribuição (pedido do usuário 2026-10-19), usada
 * no Portal do Aluno e no Relatório do Diretor:
 *  - pagou (ou é isento)                         → em dia (verde)
 *  - não pagou, mas ainda estamos até o dia 10   → a vencer, com desconto (verde/neutro)
 *  - não pagou até o dia 10 e o mês não acabou   → sem desconto, NÃO é atraso (amarelo)
 *  - o mês acabou sem pagamento                  → em atraso (vermelho)
 * Dia e mês sempre no horário de Brasília.
 */
export const DIA_LIMITE_DESCONTO = 10;

export type SituacaoMes = "em_dia" | "a_vencer" | "sem_desconto" | "em_atraso";

export function hojeBR(agora: Date = new Date()) {
  const [ano, mes, dia] = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).split("-").map(Number);
  return { ano, mes, dia };
}

/** Situação de UMA competência (ano/mês), dado o status sincronizado do Mercúrio. */
export function situacaoDoMes(status: string | null | undefined, ano: number, mes: number, hoje = hojeBR()): SituacaoMes {
  if (status === "paga" || status === "isento") return "em_dia";
  if (status === "atrasado") return "em_atraso";
  const competencia = ano * 12 + mes;
  const atual = hoje.ano * 12 + hoje.mes;
  if (competencia < atual) return "em_atraso"; // mês já terminou sem pagamento
  if (competencia > atual) return "a_vencer";
  return hoje.dia <= DIA_LIMITE_DESCONTO ? "a_vencer" : "sem_desconto";
}

/**
 * Situação geral do aluno: atraso em qualquer mês já encerrado prevalece;
 * senão vale a situação do mês atual. `statusGeral` é o Member.status
 * (negociação conta como atraso).
 */
export function situacaoGeral(
  meses: { year: number; month: number; status: string }[],
  statusGeral: string,
  hoje = hojeBR(),
): SituacaoMes {
  if (statusGeral === "atrasado" || statusGeral === "negociando") return "em_atraso";
  const atual = hoje.ano * 12 + hoje.mes;
  const encerradosEmAtraso = meses.some((m) => m.year * 12 + m.month < atual && m.year === hoje.ano && situacaoDoMes(m.status, m.year, m.month, hoje) === "em_atraso");
  if (encerradosEmAtraso) return "em_atraso";
  const doMes = meses.find((m) => m.year === hoje.ano && m.month === hoje.mes);
  return situacaoDoMes(doMes?.status ?? "em_branco", hoje.ano, hoje.mes, hoje);
}
