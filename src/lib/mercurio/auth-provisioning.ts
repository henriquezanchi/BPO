import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cria o usuário de Auth de um Member que ainda não tem login. A senha é aleatória e ninguém a vê (02/11/2026,
 * pedido do usuário: "pode excluir senha pela inicial do cpf"): a pessoa entra pelo login unificado da Acrópole
 * ou por "Esqueci minha senha". Antes a senha inicial eram os 6 primeiros números do CPF.
 *
 * Quem já tem usuário de Auth (pelo vínculo ou pelo e-mail) NÃO é tocado: só confirma o vínculo, sem trocar a senha.
 *
 * `listaUsuariosExistentes` é opcional — passar quando for chamar isso em loop (onboarding em lote busca a lista
 * 1x só, fora do loop; chamada isolada busca aqui mesmo).
 */
export async function provisionarLogin(
  memberId: string,
  email: string,
  listaUsuariosExistentes?: { id: string; email?: string }[],
): Promise<{ criado: boolean }> {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  let authUserId = member.authUserId;
  if (!authUserId) {
    let lista = listaUsuariosExistentes;
    if (!lista) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      lista = data.users;
    }
    const existente = lista.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existente) authUserId = existente.id;
  }

  if (authUserId) {
    if (authUserId !== member.authUserId) await db.member.update({ where: { id: memberId }, data: { authUserId } });
    return { criado: false };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true, // sem etapa de confirmação por e-mail — a identidade já foi confirmada pelo cadastro do Mercúrio
  });
  if (error) throw error;
  await db.member.update({ where: { id: memberId }, data: { authUserId: data.user.id } });
  return { criado: true };
}
