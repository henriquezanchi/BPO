/**
 * Prova a leitura real numa filial nova: loga 1x, pega o primeiro aluno
 * Ativo da lista, lê os dados reais dele e cria o Member correspondente no
 * banco do Portal.
 *
 * NÃO testa escrita aqui de propósito — o aluno escolhido é o primeiro da
 * lista, ou seja, uma pessoa real que não deu consentimento específico pra
 * ser sujeito de teste (diferente do teste com o Luiz, que é o dono da
 * própria conta). Escrever no cadastro dele, mesmo revertendo, é uma
 * transação real de terceiro — precisa de autorização explícita à parte.
 *
 * Uso: npx tsx --env-file=.env scripts/onboard-filial.ts <mercurioFilialLabel>
 * Ex:  npx tsx --env-file=.env scripts/onboard-filial.ts "setor oeste"
 */
import { db } from "../src/lib/db";
import {
  abrirFichaDaListaAtivos,
  abrirListaAtivos,
  abrirSessaoMercurio,
  lerAbaEnderecos,
  listarNomesDaListaAtivos,
} from "../src/lib/mercurio/browser-session";
import { parseLogradouro } from "../src/lib/mercurio/parse-logradouro";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/onboard-filial.ts "<mercurioFilialLabel>"');
  const filialLabelRegex = new RegExp(filialLabel, "i");

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola local: ${school.name} (${school.id})`);

  const { browser, page } = await abrirSessaoMercurio();
  try {
    console.log("Abrindo lista de Ativos da filial...");
    const frameAtivos = await abrirListaAtivos(page, filialLabelRegex);

    console.log("Listando os primeiros Ativos...");
    const nomes = await listarNomesDaListaAtivos(frameAtivos, 5);
    console.log("Encontrados:", nomes);
    if (nomes.length === 0) throw new Error("Nenhum aluno Ativo encontrado.");
    const nomeAlvo = nomes[0];

    console.log(`\nAbrindo ficha de "${nomeAlvo}"...`);
    const frame = await abrirFichaDaListaAtivos(page, frameAtivos, new RegExp(escapeRegex(nomeAlvo), "i"));
    const dados = await lerAbaEnderecos(frame);
    console.log("Dados lidos:", dados);
    const { street, number, complement } = parseLogradouro(dados.logradouro);

    const member = await db.member.upsert({
      where: { mercurioId: dados.matricula },
      update: {
        schoolId: school.id,
        name: dados.nomeCompleto || nomeAlvo,
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
      },
      create: {
        schoolId: school.id,
        mercurioId: dados.matricula,
        registrationNo: dados.matricula,
        name: dados.nomeCompleto || nomeAlvo,
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
        status: "em_dia",
      },
    });
    console.log(`\n✅ Member criado/atualizado: ${member.id} — ${member.name} (matrícula ${member.mercurioId})`);
    console.log("\n(Sem teste de escrita neste script — mexer no cadastro real de um aluno que não é o dono da conta, mesmo revertendo, é tratado como uma transação real que precisa de autorização explícita separada.)");
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
