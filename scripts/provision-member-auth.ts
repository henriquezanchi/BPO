/**
 * Cria (ou atualiza) o login do Portal pra um membro: senha inicial = 6
 * primeiros dígitos do CPF, lido direto do Mercúrio (não fica guardado no
 * nosso banco, só usado aqui pra derivar a senha). O membro pode trocar a
 * senha depois pelo Portal.
 *
 * Uso: npx tsx --env-file=.env scripts/provision-member-auth.ts <mercurioId> [--nome=<regex alternativa>]
 */
import { db } from "../src/lib/db";
import { provisionarLoginComSenha } from "../src/lib/mercurio/auth-provisioning";
import {
  abrirCirculoDeAmigos,
  abrirFichaDaListaAtivos,
  abrirListaAtivos,
  abrirSessaoMercurio,
  lerAbaIdentificacao,
} from "../src/lib/mercurio/browser-session";

async function main() {
  const mercurioId = process.argv[2];
  if (!mercurioId) throw new Error("Uso: npx tsx --env-file=.env scripts/provision-member-auth.ts <mercurioId>");

  const member = await db.member.findUniqueOrThrow({ where: { mercurioId }, include: { school: true } });
  if (!member.email) throw new Error(`${member.name} não tem e-mail cadastrado — não dá pra provisionar login.`);
  if (!member.school.mercurioFilialLabel) throw new Error(`Escola "${member.school.name}" sem mercurioFilialLabel configurado.`);

  console.log(`Lendo CPF real do Mercúrio pra ${member.name}...`);
  const nomeOverride = process.argv.find((a) => a.startsWith("--nome="))?.slice("--nome=".length);
  const filialRegex = new RegExp(member.school.mercurioFilialLabel, "i");
  const nomeRegex = new RegExp(nomeOverride ?? member.name, "i");
  let cpf: string;
  try {
    const { browser, page } = await abrirSessaoMercurio();
    try {
      const frameAtivos = await abrirListaAtivos(page, filialRegex);
      const frame = await abrirFichaDaListaAtivos(page, frameAtivos, nomeRegex);
      const identificacao = await lerAbaIdentificacao(frame);
      cpf = identificacao.cpf.replace(/\D/g, "");
    } finally {
      await browser.close();
    }
  } catch {
    // Não achou na lista de Ativos — tenta Círculo de Amigos (lista
    // separada, "COMPLEMENTAR" no Mercúrio — ver onboard-circulo-amigos.ts
    // e o mesmo achado em sync-active-status.ts). Sessão NOVA (não
    // reaproveita a página da tentativa acima) — abrirCirculoDeAmigos
    // precisa navegar do menu de topo, que só existe logo após o login
    // (mesmo bug de navegação já visto em sync-receipts.ts).
    console.log(`Não encontrado em Ativos — tentando Círculo de Amigos (nova sessão)...`);
    const { browser, page } = await abrirSessaoMercurio();
    try {
      const frameCirculo = await abrirCirculoDeAmigos(page, filialRegex);
      const frame = await abrirFichaDaListaAtivos(page, frameCirculo, nomeRegex);
      const identificacao = await lerAbaIdentificacao(frame);
      cpf = identificacao.cpf.replace(/\D/g, "");
    } finally {
      await browser.close();
    }
  }

  if (cpf.length < 6) throw new Error(`CPF não encontrado ou incompleto no Mercúrio (valor lido: "${cpf}").`);
  const senhaInicial = cpf.slice(0, 6);

  console.log(`Provisionando login (e-mail: ${member.email})...`);
  const { criado } = await provisionarLoginComSenha(member.id, member.email, senhaInicial);
  console.log(criado ? "Usuário criado e vinculado ao Member." : "Usuário já existia — senha redefinida e vínculo confirmado.");

  console.log(`\n✅ Login pronto: ${member.email} / ${senhaInicial} (6 primeiros dígitos do CPF — repassar ao membro, não é secreto além disso)`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
