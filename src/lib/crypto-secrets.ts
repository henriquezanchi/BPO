import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Criptografia simétrica (AES-256-GCM) pra segredo de terceiro que
 * precisamos GUARDAR DE VERDADE (não é hash — precisamos decifrar depois
 * pra usar, ex: senha da Acrópole Play pra login automático — ver
 * acropoleplay-actions.ts). Diferente da credencial do Mercúrio
 * (scraper-credentials.ts), que é 1 conta compartilhada cifrada no projeto
 * Supabase irmão — aqui é 1 segredo POR MEMBRO, cifrado neste mesmo banco.
 *
 * CREDENTIALS_ENCRYPTION_KEY precisa existir em TODO ambiente (local,
 * Vercel, Railway) — sem ela, nada que já foi cifrado consegue ser lido de
 * volta. Gerar 1x com `openssl rand -hex 32` e nunca trocar depois de ter
 * dado real cifrado (perderia acesso a tudo que já foi salvo).
 */
function getChave(): Buffer {
  const segredo = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!segredo) throw new Error("CREDENTIALS_ENCRYPTION_KEY não configurada.");
  // scrypt deriva uma chave de 32 bytes de qualquer string — aceita tanto
  // um hex de 64 chars quanto qualquer senha mais curta, sem exigir
  // formato exato no env var.
  return scryptSync(segredo, "credentials-encryption-salt", 32);
}

/** Formato: "iv:authTag:ciphertext", tudo em base64. */
export function cifrarSegredo(textoPlano: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getChave(), iv);
  const ciphertext = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decifrarSegredo(cifrado: string): string {
  const [ivB64, authTagB64, ciphertextB64] = cifrado.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error("Formato de segredo cifrado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", getChave(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const textoPlano = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return textoPlano.toString("utf8");
}
