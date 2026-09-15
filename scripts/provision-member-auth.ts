/**
 * Cria (ou atualiza) o login do Portal pra um membro: senha inicial = 6
 * primeiros dígitos do CPF, lido direto do Mercúrio (não fica guardado no
 * nosso banco, só usado aqui pra derivar a senha). O membro pode trocar a
 * senha depois pelo Portal.
 *
 * Uso: npx tsx --env-file=.env scripts/provision-member-auth.ts <mercurioId>
 */
import { db } from "../src/lib/db";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { abrirFichaDaListaAtivos, abrirListaAtivos, abrirSessaoMercurio, lerAbaIdentificacao } from "../src/lib/mercurio/browser-session";

async function main() {
  const mercurioId = process.argv[2];
  if (!mercurioId) throw new Error("Uso: npx tsx --env-file=.env scripts/provision-member-auth.ts <mercurioId>");

  const member = await db.member.findUniqueOrThrow({ where: { mercurioId }, include: { school: true } });
  if (!member.email) throw new Error(`${member.name} não tem e-mail cadastrado — não dá pra provisionar login.`);
  if (!member.school.mercurioFilialLabel) throw new Error(`Escola "${member.school.name}" sem mercurioFilialLabel configurado.`);

  console.log(`Lendo CPF real do Mercúrio pra ${member.name}...`);
  const { browser, page } = await abrirSessaoMercurio();
  let cpf: string;
  try {
    const frameAtivos = await abrirListaAtivos(page, new RegExp(member.school.mercurioFilialLabel, "i"));
    const frame = await abrirFichaDaListaAtivos(page, frameAtivos, new RegExp(member.name, "i"));
    const identificacao = await lerAbaIdentificacao(frame);
    cpf = identificacao.cpf.replace(/\D/g, "");
  } finally {
    await browser.close();
  }

  if (cpf.length < 6) throw new Error(`CPF não encontrado ou incompleto no Mercúrio (valor lido: "${cpf}").`);
  const senhaInicial = cpf.slice(0, 6);

  console.log(`Provisionando login (e-mail: ${member.email})...`);

  let authUserId = member.authUserId;
  if (!authUserId) {
    // Pode já existir um usuário de Auth com esse e-mail (ex: provisionamento
    // anterior que não terminou de vincular) — busca antes de tentar criar.
    const { data: lista, error: erroLista } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (erroLista) throw erroLista;
    const existente = lista.users.find((u) => u.email?.toLowerCase() === member.email!.toLowerCase());
    if (existente) authUserId = existente.id;
  }

  if (authUserId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: senhaInicial });
    if (error) throw error;
    if (authUserId !== member.authUserId) await db.member.update({ where: { id: member.id }, data: { authUserId } });
    console.log("Usuário já existia — senha redefinida pra o padrão (6 primeiros dígitos do CPF) e vínculo confirmado.");
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: member.email,
      password: senhaInicial,
      email_confirm: true, // sem etapa de confirmação por e-mail — o próprio provisionamento já confirma a identidade via CPF do Mercúrio
    });
    if (error) throw error;
    authUserId = data.user.id;
    await db.member.update({ where: { id: member.id }, data: { authUserId } });
    console.log("Usuário criado e vinculado ao Member.");
  }

  console.log(`\n✅ Login pronto: ${member.email} / senha inicial (6 primeiros dígitos do CPF)`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
