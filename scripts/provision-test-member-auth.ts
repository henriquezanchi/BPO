/**
 * Provisiona login pra um membro de SEED (sem mercurioId, ex: o professor
 * de teste) — provision-member-auth.ts não serve aqui pois lê o CPF real do
 * Mercúrio pra derivar a senha, e esse membro não existe lá. Senha vem por
 * argumento.
 *
 * Uso: npx tsx --env-file=.env scripts/provision-test-member-auth.ts <memberId> <senha>
 */
import { db } from "../src/lib/db";
import { supabaseAdmin } from "../src/lib/supabase/admin";

async function main() {
  const memberId = process.argv[2];
  const senha = process.argv[3];
  if (!memberId || !senha) throw new Error("Uso: npx tsx --env-file=.env scripts/provision-test-member-auth.ts <memberId> <senha>");

  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (!member.email) throw new Error(`${member.name} não tem e-mail cadastrado.`);

  let authUserId = member.authUserId;
  if (!authUserId) {
    const { data: lista, error: erroLista } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (erroLista) throw erroLista;
    const existente = lista.users.find((u) => u.email?.toLowerCase() === member.email!.toLowerCase());
    if (existente) authUserId = existente.id;
  }

  if (authUserId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: senha });
    if (error) throw error;
    if (authUserId !== member.authUserId) await db.member.update({ where: { id: member.id }, data: { authUserId } });
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: member.email,
      password: senha,
      email_confirm: true,
    });
    if (error) throw error;
    authUserId = data.user.id;
    await db.member.update({ where: { id: member.id }, data: { authUserId } });
  }

  console.log(`✅ Login pronto: ${member.email} / ${senha}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
