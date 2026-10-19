/**
 * Abre uma filial no Portal a partir do banco de consulta do Mercúrio (sem
 * robô): importa todos os ativos e cria o login de quem tem e-mail e CPF
 * (senha inicial = 6 primeiros números do CPF). Pedido do usuário 2026-10-19
 * (Lago Sul).
 *
 * Cuidados:
 *  - quem já tem login NÃO é tocado (recriar trocaria a senha);
 *  - e-mail que já existe no Auth (outra conta) não é sobrescrito: só listado;
 *  - nenhum e-mail é enviado (email_confirm direto, como nas outras aberturas).
 *
 * Uso: npx tsx --env-file=.env scripts/abrir-filial-db.ts LGS [--gravar]
 *      (sem --gravar só simula e mostra os números)
 */
import { db } from "../src/lib/db";
import { provisionarLoginComSenha } from "../src/lib/mercurio/auth-provisioning";
import { consultarTudo, sincronizarUnidade } from "../src/lib/mercurio-db/importar";
import { supabaseAdmin } from "../src/lib/supabase/admin";

async function todosUsuariosAuth() {
  const lista: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    lista.push(...data.users);
    if (data.users.length < 1000) return lista;
  }
}

async function main() {
  const uni = process.argv[2];
  const gravar = process.argv.includes("--gravar");
  if (!uni) throw new Error("Informe a unidade, ex.: LGS");

  const cadastros = await consultarTudo(`SELECT cad_matr, cad_email, cad_cpf FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade='${uni.replace(/[^A-Z0-9]/gi, "")}' ORDER BY cad_matr`);
  const cpfPor = new Map(cadastros.map((c) => [c.cad_matr!, String(c.cad_cpf ?? "").replace(/\D/g, "")]));
  console.log(`${uni}: ${cadastros.length} ativos no Mercúrio`);
  if (!gravar) {
    const comEmail = cadastros.filter((c) => /@/.test(c.cad_email ?? "")).length;
    const comCpf = cadastros.filter((c) => String(c.cad_cpf ?? "").replace(/\D/g, "").length >= 6).length;
    const jaNoPortal = await db.member.count({ where: { mercurioId: { in: cadastros.map((c) => c.cad_matr!) } } });
    console.log(`simulação: com e-mail ${comEmail} · com CPF ${comCpf} · já no Portal ${jaNoPortal}. Rode com --gravar para abrir.`);
    return;
  }

  const { school, importados } = await sincronizarUnidade(uni, { matriculas: cadastros.map((c) => c.cad_matr!) });
  console.log(`importados/atualizados: ${importados} (${school.name})`);
  await db.school.update({ where: { id: school.id }, data: { portalAberto: true } });

  const usuarios = await todosUsuariosAuth();
  const emailsAuth = new Set(usuarios.map((u) => u.email?.toLowerCase()).filter(Boolean));
  const membros = await db.member.findMany({ where: { schoolId: school.id, mercurioAtivo: true }, select: { id: true, name: true, email: true, authUserId: true, mercurioId: true } });
  let criados = 0;
  const semEmail: string[] = [];
  const semCpf: string[] = [];
  const emailEmUso: string[] = [];
  for (const m of membros) {
    if (m.authUserId) continue; // já tem login: não mexe
    const email = m.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      semEmail.push(m.name);
      continue;
    }
    const cpf = cpfPor.get(m.mercurioId ?? "") ?? "";
    if (cpf.length < 6) {
      semCpf.push(m.name);
      continue;
    }
    if (emailsAuth.has(email)) {
      emailEmUso.push(`${m.name} (${email})`);
      continue;
    }
    const { criado } = await provisionarLoginComSenha(m.id, email, cpf.slice(0, 6), usuarios);
    if (criado) {
      criados++;
      emailsAuth.add(email);
    }
  }
  console.log(`logins criados: ${criados} · já tinham login: ${membros.filter((m) => m.authUserId).length}`);
  if (semEmail.length) console.log(`sem e-mail (${semEmail.length}): ${semEmail.join("; ")}`);
  if (semCpf.length) console.log(`sem CPF (${semCpf.length}): ${semCpf.join("; ")}`);
  if (emailEmUso.length) console.log(`e-mail já usado por outra conta (${emailEmUso.length}): ${emailEmUso.join("; ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
