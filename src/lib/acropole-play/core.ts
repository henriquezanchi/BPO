import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const PLAY_LOGIN = "https://membros.acropoleplay.com/auth/login";
export function normalizarEmailPlay(email: string) { return email.trim().toLowerCase(); }
export function hashEmailPlay(email: string) { return createHash("sha256").update(normalizarEmailPlay(email)).digest("hex"); }
export function normalizarNomePlay(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function validarLinkPlay(valor: string): string {
  // Nunca incluir o valor recebido em uma exceção: contém uma credencial.
  let u: URL;
  try { u = new URL(valor.trim()); } catch { throw new Error("Link automático inválido."); }
  if (u.protocol !== "https:" || u.hostname !== "membros.acropoleplay.com" || u.port || u.username || u.password || u.hash || u.pathname !== "/auth/login" ||
      [...u.searchParams.keys()].length !== 1 || !u.searchParams.get("crstk") || u.searchParams.get("crstk")!.length > 8192) {
    throw new Error("Formato de link automático não permitido.");
  }
  return u.href;
}
export function chavePlay(base64 = process.env.ACROPOLE_PLAY_ENCRYPTION_KEY): Buffer {
  if (!base64 || !/^[A-Za-z0-9+/]{43}=$/.test(base64)) throw new Error("Configure ACROPOLE_PLAY_ENCRYPTION_KEY com 32 bytes em base64.");
  const chave = Buffer.from(base64, "base64");
  if (chave.length !== 32 || chave.toString("base64") !== base64) throw new Error("Chave da Acrópole Play inválida.");
  return chave;
}
export type VinculoPlay = { memberId: string; sourceStudentId: string; emailHash: string };
function aad(v: VinculoPlay) { return Buffer.from(JSON.stringify(["acropole-play-v1", v.memberId, v.sourceStudentId, v.emailHash])); }
export function cifrarLinkPlay(link: string, vinculo: VinculoPlay, chave: Buffer): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", chave, iv);
  cipher.setAAD(aad(vinculo));
  const texto = Buffer.concat([cipher.update(validarLinkPlay(link), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), texto.toString("base64")].join(".");
}
export function decifrarLinkPlay(cifrado: string, vinculo: VinculoPlay, chave: Buffer): string {
  try {
    const partes = cifrado.split(".");
    if (partes.length !== 4 || partes[0] !== "v1") throw new Error();
    const iv = Buffer.from(partes[1], "base64"), tag = Buffer.from(partes[2], "base64");
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", chave, iv);
    decipher.setAAD(aad(vinculo)); decipher.setAuthTag(tag);
    return validarLinkPlay(Buffer.concat([decipher.update(Buffer.from(partes[3], "base64")), decipher.final()]).toString("utf8"));
  } catch { throw new Error("Não foi possível abrir o acesso da Acrópole Play."); }
}
export function identidadePlayConfere(email: string | undefined, confirmado: boolean, emailHash: string) {
  return !!email && confirmado && hashEmailPlay(email) === emailHash;
}
