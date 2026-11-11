/**
 * Interessado qualificado (pedido do usuário 11/11/2026): os leads da base do CRM do Ulisses são contatos a trabalhar,
 * não interessados. Interessado é quem tem ao menos um destes motivos e ainda não se matriculou:
 *  - perguntou do curso no WhatsApp;
 *  - foi a uma aula inaugural (ou palestra);
 *  - se inscreveu na abertura de turma;
 *  - a escola registrou que tem interesse (disse pessoalmente, pediu matrícula, participou de outra atividade).
 * Fontes: sinais do CRM (quando o Ulisses passar a enviar: `interesse.estado` + `interesse.fonte`, ou `sinais`), o vínculo
 * do lead com a abertura (`aberturaId`) e os sinais que a escola registra no Portal (AberturaRegistro tipo "sinal").
 * Fica de fora quem pediu para não ser contatado, quem declarou não ter interesse por último e quem já tem matrícula.
 * Função pura (usada no servidor e nos testes).
 */
export type SinalInteresse = { tipo?: unknown; valor?: unknown; origem?: unknown; occurredAt?: unknown; registradoEm?: unknown };
export type LeadParaQualificar = {
  id?: unknown;
  aberturaId?: unknown;
  naoContatar?: unknown;
  interesse?: { estado?: unknown; fonte?: unknown } | null;
};

export const MOTIVO = {
  whatsapp: "Perguntou no WhatsApp",
  aulaInaugural: "Foi à aula inaugural",
  inscricao: "Inscreveu-se na abertura",
  declarado: "Disse que tem interesse",
  pedidoMatricula: "Pediu matrícula",
  outraAtividade: "Participou de outra atividade",
  crm: "Interesse informado pelo CRM",
} as const;

const POSITIVOS = new Set(["conhecer", "participar", "inscrever"]);
const ehWhatsapp = (v: unknown) => typeof v === "string" && /whats|wpp|zap/i.test(v);
const ehAulaInaugural = (v: unknown) => typeof v === "string" && /inaugural|palestra/i.test(v);
const quando = (s: SinalInteresse) => Date.parse(String(s.occurredAt ?? s.registradoEm ?? "")) || 0;

/** Motivos de interesse do lead, ou lista vazia se não é (ou deixou de ser) interessado. */
export function motivosDeInteresse(lead: LeadParaQualificar, sinais: SinalInteresse[], matriculado: boolean): string[] {
  if (matriculado || lead.naoContatar === true) return [];
  const ordenados = [...sinais].sort((a, b) => quando(a) - quando(b));
  const ultimo = (tipo: string) => [...ordenados].reverse().find((s) => s.tipo === tipo);
  if (ultimo("nao_contatar")?.valor === true) return [];

  const motivos = new Set<string>();
  const interesse = ultimo("interesse_declarado");
  if (interesse?.valor === "nao") return [];
  if (interesse && POSITIVOS.has(String(interesse.valor))) motivos.add(ehWhatsapp(interesse.origem) ? MOTIVO.whatsapp : MOTIVO.declarado);
  if (ordenados.some((s) => s.tipo === "interesse_declarado" && POSITIVOS.has(String(s.valor)) && ehWhatsapp(s.origem))) motivos.add(MOTIVO.whatsapp);
  if (ultimo("presenca_palestra")?.valor === true) motivos.add(MOTIVO.aulaInaugural);
  if (ultimo("pedido_matricula")?.valor === true) motivos.add(MOTIVO.pedidoMatricula);
  if (ultimo("outra_atividade")?.valor === true) motivos.add(MOTIVO.outraAtividade);

  if (typeof lead.aberturaId === "string" && lead.aberturaId) motivos.add(MOTIVO.inscricao);

  const crm = lead.interesse;
  if (crm && POSITIVOS.has(String(crm.estado))) motivos.add(ehWhatsapp(crm.fonte) ? MOTIVO.whatsapp : ehAulaInaugural(crm.fonte) ? MOTIVO.aulaInaugural : MOTIVO.crm);
  if (crm?.estado === "nao") return [];

  return [...motivos];
}
