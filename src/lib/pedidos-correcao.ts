/**
 * Situação dos pedidos de correção do cadastro, para o próprio aluno em "Meus dados" (avaliação de design, 10/11/2026:
 * antes só aparecia "já tem uma em análise"). Puro: traduz os campos pedidos em nomes que o aluno reconhece.
 */
const ROTULOS: [RegExp, string][] = [
  [/^whatsapp$/i, "WhatsApp"],
  [/^email$/i, "E-mail"],
  [/^address/i, "Endereço"],
  [/^birthDate$/i, "Nascimento"],
  [/^naturalidade$/i, "Naturalidade"],
  [/^profession$/i, "Profissão"],
  [/^estadoCivil$/i, "Estado civil"],
  [/^escolaridade$/i, "Escolaridade"],
  [/^rg/i, "RG"],
];

/** Nomes dos dados pedidos, sem repetir (todos os campos do endereço viram "Endereço"). */
export function camposDoPedido(novos: unknown): string[] {
  if (!novos || typeof novos !== "object") return [];
  const nomes = Object.keys(novos as Record<string, unknown>).map((k) => ROTULOS.find(([re]) => re.test(k))?.[1] ?? null);
  return [...new Set(nomes.filter((n): n is string => !!n))];
}

export type SituacaoPedido = "em_analise" | "aprovado" | "recusado";
export const situacaoDoPedido = (status: string): SituacaoPedido | null =>
  status === "pendente" ? "em_analise" : status === "aprovado" ? "aprovado" : status === "rejeitado" ? "recusado" : null;
export const ROTULO_SITUACAO_PEDIDO: Record<SituacaoPedido, string> = { em_analise: "Em análise", aprovado: "Aprovado", recusado: "Não aprovado" };
