import "server-only";
import crypto from "node:crypto";

/**
 * CPF completo cifrado (AES-256-GCM, chave MATRICULA_CPF_CHAVE, 32 bytes em base64) só enquanto a matrícula feita
 * pelo site não foi lançada no Mercúrio (pedido do usuário 2026-10-25). Depois do lançamento, apaga-se o cifrado
 * e fica só o início do CPF, como no resto do Portal.
 */
function chave() {
  const k = Buffer.from(process.env.MATRICULA_CPF_CHAVE ?? "", "base64");
  if (k.length !== 32) throw new Error("MATRICULA_CPF_CHAVE ausente ou inválida.");
  return k;
}

export function cifrarCpf(cpf: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(cpf, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64")).join(".");
}

export function decifrarCpf(cifrado: string): string {
  const [iv, tag, dados] = cifrado.split(".").map((p) => Buffer.from(p, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}

/** CPF válido (dígitos verificadores). */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}
