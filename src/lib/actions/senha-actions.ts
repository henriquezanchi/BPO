"use server";

import { ehAdministradorNacional } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { consultarMercurio } from "@/lib/mercurio-db/client";
import { podeAdministrar } from "@/lib/recursos-filial";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * "Esqueci minha senha" (pedido do usuário 2026-10-19), por dois caminhos:
 *  1. Link por e-mail (Supabase Auth). Só entrega de verdade quando houver um
 *     provedor de e-mail (SMTP próprio) configurado no Supabase — sem ele, o
 *     Supabase só envia para a equipe do projeto e no máximo 2 por hora.
 *  2. A administração da filial volta a senha da pessoa para a inicial (6
 *     primeiros números do CPF, lido na hora do banco de consulta do
 *     Mercúrio — o CPF não fica guardado no Portal). Funciona já.
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

export async function voltarSenhaInicial(memberId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false, error: "Entre no Portal." };
  const alvo = await db.member.findUnique({ where: { id: memberId }, select: { id: true, schoolId: true, authUserId: true, mercurioId: true, mercurioAtivo: true } });
  if (!alvo) return { ok: false, error: "Pessoa não encontrada." };
  if (!(await podeAdministrar(eu, alvo.schoolId)) && !(await ehAdministradorNacional(eu))) return { ok: false, error: "Só a administração da filial redefine senhas." };
  if (!alvo.authUserId) return { ok: false, error: "Essa pessoa ainda não tem login no Portal." };
  if (!alvo.mercurioId || !/^\d+$/.test(alvo.mercurioId)) return { ok: false, error: "Matrícula do Mercúrio não encontrada." };
  const [linha] = await consultarMercurio(`SELECT cad_cpf FROM cadastro WHERE cad_matr=${Number(alvo.mercurioId)} LIMIT 1`);
  const cpf = String(linha?.cad_cpf ?? "").replace(/\D/g, "");
  if (cpf.length < 6) return { ok: false, error: "CPF ausente no Mercúrio: corrija o cadastro antes de redefinir." };
  const { error } = await supabaseAdmin.auth.admin.updateUserById(alvo.authUserId, { password: cpf.slice(0, 6) });
  if (error) return { ok: false, error: "Não foi possível redefinir agora. Tente de novo." };
  await db.redefinicaoSenha.create({ data: { memberId: alvo.id, porId: eu.id } });
  return { ok: true };
}
