import crypto from "node:crypto";

/**
 * Cifra segredos guardados no banco (AES-256-GCM). A chave de cada finalidade é derivada (HKDF) da chave mestra
 * MATRICULA_CPF_CHAVE, já configurada no .env e na Vercel: finalidades diferentes nunca usam a mesma chave, e não
 * é preciso uma variável nova. Formato: iv.tag.dados, em base64url.
 */
function chave(finalidade: string) {
  const mestra = Buffer.from(process.env.MATRICULA_CPF_CHAVE ?? "", "base64");
  if (mestra.length !== 32) throw new Error("MATRICULA_CPF_CHAVE ausente ou inválida (32 bytes em base64).");
  return Buffer.from(crypto.hkdfSync("sha256", mestra, Buffer.alloc(0), `portal-na:${finalidade}`, 32));
}

export function cifrar(texto: string, finalidade: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", chave(finalidade), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64url")).join(".");
}

export function decifrar(cifrado: string, finalidade: string): string {
  const [iv, tag, dados] = cifrado.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", chave(finalidade), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}
