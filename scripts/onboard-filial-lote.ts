/**
 * Onboarding em lote de uma filial inteira, numa sessão do Mercúrio só:
 * lê a lista de Ativos 1x (matrícula+nome), decide quem ainda precisa de
 * Member local e/ou login, e só visita a ficha de quem precisa —
 * revisitando a lista de Ativos do zero entre cada ficha (resetarNavegacao
 * + abrirListaAtivos de novo), já que navegar "pra trás" dentro de um
 * frameset tem comportamento incerto sem teste real (mesma cautela do
 * scraper irmão deste projeto, crm-agencia-na/scraper/mercurio.js).
 *
 * Cria/atualiza o Member (endereço, telefone, e-mail) e, se tiver e-mail e
 * CPF legíveis, provisiona o login (senha inicial = 6 primeiros dígitos
 * do CPF, nunca guardado no nosso banco). Erro em 1 ativo não para os
 * demais.
 *
 * Uso: npx tsx --env-file=.env scripts/onboard-filial-lote.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { provisionarLoginComSenha } from "../src/lib/mercurio/auth-provisioning";
import {
  abrirFichaDaListaAtivos,
  abrirListaAtivos,
  abrirSessaoMercurio,
  lerAbaEnderecos,
  lerAbaIdentificacao,
  listarAtivosResumo,
  resetarNavegacao,
} from "../src/lib/mercurio/browser-session";
import { parseLogradouro } from "../src/lib/mercurio/parse-logradouro";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/onboard-filial-lote.ts "<mercurioFilialLabel>"');
  const filialLabelRegex = new RegExp(filialLabel, "i");

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const { browser, page } = await abrirSessaoMercurio();
  try {
    const frameAtivos = await abrirListaAtivos(page, filialLabelRegex);
    const ativos = await listarAtivosResumo(frameAtivos);
    console.log(`Ativos encontrados no Mercúrio: ${ativos.length}`);

    const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id } });
    const membroPorMatricula = new Map(membrosConhecidos.filter((m) => m.mercurioId).map((m) => [m.mercurioId!, m]));

    const pendentes = ativos.filter((a) => {
      const membro = membroPorMatricula.get(a.matricula);
      return !membro || !membro.authUserId; // sem Member local, ou sem login ainda
    });
    console.log(`Pendentes de onboarding (sem Member local ou sem login): ${pendentes.length} de ${ativos.length}\n`);
    if (pendentes.length === 0) {
      console.log("✅ Nada a fazer — todo mundo já tem Member + login.");
      return;
    }

    const { data: authData, error: erroListaAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (erroListaAuth) throw erroListaAuth;

    let membrosCriadosOuAtualizados = 0;
    let loginsProvisionados = 0;
    let semEmail = 0;
    let semCpf = 0;
    let comErro = 0;

    for (const ativo of pendentes) {
      try {
        await resetarNavegacao(page);
        const frameAtivosDeNovo = await abrirListaAtivos(page, filialLabelRegex);
        const frame = await abrirFichaDaListaAtivos(page, frameAtivosDeNovo, new RegExp(escapeRegex(ativo.nome), "i"));
        const dados = await lerAbaEnderecos(frame);
        const identificacao = await lerAbaIdentificacao(frame);
        const { street, number, complement } = parseLogradouro(dados.logradouro);

        const dadosComuns = {
          schoolId: school.id,
          name: dados.nomeCompleto || ativo.nome,
          whatsapp: `${dados.celularDdd}${dados.celularNumero}` || "",
          whatsappAlt: dados.alternativoDdd && dados.alternativoNumero ? `${dados.alternativoDdd}${dados.alternativoNumero}` : null,
          email: dados.email || null,
          addressStreet: street || null,
          addressNumber: number || null,
          addressComplement: complement || null,
          addressNeighborhood: dados.bairro || null,
          addressCity: dados.cidade || null,
          addressState: dados.uf || null,
          addressZip: dados.cep || null,
        };

        const member = await db.member.upsert({
          where: { mercurioId: dados.matricula },
          update: dadosComuns,
          create: { ...dadosComuns, mercurioId: dados.matricula, registrationNo: dados.matricula, status: "em_dia" },
        });
        membrosCriadosOuAtualizados++;

        if (!member.email) {
          console.log(`⚠ ${member.name}: sem e-mail no Mercúrio — Member ok, login NÃO provisionado.`);
          semEmail++;
          continue;
        }

        const cpf = identificacao.cpf.replace(/\D/g, "");
        if (cpf.length < 6) {
          console.log(`⚠ ${member.name}: CPF ausente/incompleto no Mercúrio — login NÃO provisionado.`);
          semCpf++;
          continue;
        }

        const senhaInicial = cpf.slice(0, 6);
        const { criado } = await provisionarLoginComSenha(member.id, member.email, senhaInicial, authData.users);
        console.log(`✓ ${member.name} (${member.email}): login ${criado ? "criado" : "atualizado"}.`);
        loginsProvisionados++;
      } catch (e) {
        comErro++;
        console.error(`✗ Falha em "${ativo.nome}" (matrícula ${ativo.matricula}):`, (e as Error).message);
      }
    }

    console.log(
      `\n✅ Onboarding em lote concluído: ${membrosCriadosOuAtualizados} Member(s) criado(s)/atualizado(s), ${loginsProvisionados} login(s) provisionado(s), ${semEmail} sem e-mail, ${semCpf} sem CPF legível, ${comErro} com erro.`,
    );
  } finally {
    await browser.close();
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
