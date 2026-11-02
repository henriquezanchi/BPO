"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * "Esqueci minha senha" (pedido do usuário 2026-10-19): link por e-mail (Supabase Auth). Só entrega de verdade
 * quando houver um provedor de e-mail (SMTP próprio) configurado no Supabase — sem ele, o Supabase só envia para a
 * equipe do projeto e no máximo 2 por hora. O caminho principal de entrada é o login unificado da Acrópole.
 * A volta da senha para os 6 primeiros números do CPF pela administração foi retirada em 02/11/2026 (pedido do
 * usuário: "pode excluir senha pela inicial do cpf").
 */

/** Sempre a mesma resposta, exista ou não o e-mail (não revela quem tem cadastro). */
export async function pedirLinkDeSenha(email: string): Promise<{ ok: boolean }> {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false };
  const h = await headers();
  const origem = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: `${origem}/auth/redefinir` });
  if (error) console.warn("[Senha] envio do link falhou:", error.status, error.code);
  return { ok: true };
}
