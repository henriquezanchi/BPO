import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cria/atualiza o usuário de Auth pra um Member já com e-mail e senha
 * (derivada dos 6 primeiros dígitos do CPF real, lido do Mercúrio — ver
 * chamadores). Fatorado de provision-member-auth.ts pra reaproveitar no
 * onboarding em lote (scripts/onboard-filial-lote.ts) sem duplicar a lógica
 * de "já existe usuário de Auth com esse e-mail?".
 *
 * `listaUsuariosExistentes` é opcional — passar quando for chamar isso em
 * loop (onboarding em lote busca a lista 1x só, fora do loop; chamada
 * isolada busca aqui mesmo).
 */
export async function provisionarLoginComSenha(
  memberId: string,
  email: string,
  senha: string,
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
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: senha });
    if (error) throw error;
    if (authUserId !== member.authUserId) await db.member.update({ where: { id: memberId }, data: { authUserId } });
    return { criado: false };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // sem etapa de confirmação por e-mail — a identidade já foi confirmada via CPF do Mercúrio
  });
  if (error) throw error;
  await db.member.update({ where: { id: memberId }, data: { authUserId: data.user.id } });
  return { criado: true };
}
