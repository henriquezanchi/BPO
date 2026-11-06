import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Carteirinha digital (pedido do usuário 07/11/2026). O QR leva "NAC1.<matrícula>.<assinatura>": a recepção lê com a
 * câmera e o Portal confere a assinatura antes de marcar a presença, para que um QR montado à mão com outra matrícula
 * não passe. A situação (ativo ou não) é sempre conferida na hora, nunca lida do QR. Segredo: CARTEIRINHA_SEGREDO, ou
 * derivado do CRON_SECRET quando ela não existe (os dois só no servidor).
 */
const PREFIXO = "NAC1";

function segredo() {
  const s = process.env.CARTEIRINHA_SEGREDO || (process.env.CRON_SECRET ? `carteirinha:${process.env.CRON_SECRET}` : "");
  if (!s) throw new Error("Segredo da carteirinha não configurado.");
  return s;
}

const assinar = (matricula: string, chave: string) => createHmac("sha256", chave).update(`${PREFIXO}:${matricula}`).digest("base64url").slice(0, 16);

export function codigoDaCarteirinha(matricula: string, chave = segredo()) {
  if (!/^\d+$/.test(matricula)) throw new Error("Matrícula inválida.");
  return `${PREFIXO}.${matricula}.${assinar(matricula, chave)}`;
}

/** Matrícula do QR, se a assinatura confere; null em qualquer outro caso. */
export function lerCodigoDaCarteirinha(codigo: string, chave = segredo()): string | null {
  const m = /^NAC1\.(\d{1,10})\.([A-Za-z0-9_-]{16})$/.exec(codigo.trim());
  if (!m) return null;
  const esperado = Buffer.from(assinar(m[1], chave));
  const recebido = Buffer.from(m[2]);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? m[1] : null;
}

/**
 * Convite "Indicar um amigo" (07/11/2026): link /convite/<matrícula>.<assinatura>. A assinatura impede que alguém troque
 * a matrícula no link e veja o nome de outra pessoa; a indicação fica registrada na matrícula online do amigo.
 */
const assinarConvite = (matricula: string, chave: string) => createHmac("sha256", chave).update(`CONV:${matricula}`).digest("base64url").slice(0, 12);

export function codigoDeConvite(matricula: string, chave = segredo()) {
  if (!/^\d+$/.test(matricula)) throw new Error("Matrícula inválida.");
  return `${matricula}.${assinarConvite(matricula, chave)}`;
}

export function lerCodigoDeConvite(codigo: string, chave = segredo()): string | null {
  const m = /^(\d{1,10})\.([A-Za-z0-9_-]{12})$/.exec((codigo ?? "").trim());
  if (!m) return null;
  const esperado = Buffer.from(assinarConvite(m[1], chave));
  const recebido = Buffer.from(m[2]);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? m[1] : null;
}
