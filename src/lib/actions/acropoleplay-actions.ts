"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { cifrarSegredo, decifrarSegredo } from "@/lib/crypto-secrets";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Login automático na Acrópole Play (membros.acropoleplay.com) — SOLUÇÃO
 * PROVISÓRIA (pedido do usuário 2026-10-08), enquanto verificamos se existe
 * API/SSO oficial deles. Guardamos e-mail+senha cifrados (ver
 * src/lib/crypto-secrets.ts) só pra montar o auto-submit de um form
 * escondido no navegador do PRÓPRIO membro (ver AcropolePlayButton) —
 * NUNCA fazemos a chamada de login pelo nosso servidor (não dá pra
 * transferir cookie de sessão de um domínio pro outro; quem precisa
 * literalmente logar é o navegador do membro).
 */

/** Pra UI saber se já tem credencial salva, sem nunca devolver a senha. */
export async function getAcropolePlayStatus(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { acropolePlayEmail: true } });
  return { configurado: !!member.acropolePlayEmail, email: member.acropolePlayEmail };
}

export async function salvarCredencialAcropolePlay(memberId: string, email: string, senha: string) {
  await requireAuthenticatedMember(memberId);
  if (!email.trim() || !senha) return { ok: false as const, error: "Preencha e-mail e senha." };

  await db.member.update({
    where: { id: memberId },
    data: { acropolePlayEmail: email.trim(), acropolePlaySenhaCifrada: cifrarSegredo(senha) },
  });
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function removerCredencialAcropolePlay(memberId: string) {
  await requireAuthenticatedMember(memberId);
  await db.member.update({ where: { id: memberId }, data: { acropolePlayEmail: null, acropolePlaySenhaCifrada: null } });
  revalidatePath("/portal");
  return { ok: true as const };
}

/**
 * Devolve e-mail+senha em texto puro — só pro PRÓPRIO membro autenticado,
 * só no instante do clique em "Acessar", pra montar o form escondido que
 * o navegador dele mesmo vai submeter. Nunca persiste em log nem em
 * nenhum outro lugar.
 */
export async function gerarAutoLoginAcropolePlay(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { acropolePlayEmail: true, acropolePlaySenhaCifrada: true },
  });
  if (!member.acropolePlayEmail || !member.acropolePlaySenhaCifrada) {
    return { ok: false as const, error: "Nenhuma credencial salva." };
  }
  return { ok: true as const, email: member.acropolePlayEmail, senha: decifrarSegredo(member.acropolePlaySenhaCifrada) };
}
