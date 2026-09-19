/**
 * Cria a subconta Asaas de uma escola (1x por escola) — a cobrança
 * continua sendo criada pela conta do BPO (1 API key só, gerencia N
 * escolas), e o split (ver payment-actions.ts) manda a fatia da escola
 * pra esta wallet, ficando a taxa do BPO retida automaticamente.
 *
 * DRY-RUN por padrão (só mostra o que seria enviado, não cria nada de
 * verdade) — passe --confirm pra criar a subconta de verdade. Isso
 * registra uma identidade financeira real no Asaas; revisar os dados
 * antes é importante.
 *
 * Uso: npx tsx --env-file=.env scripts/create-asaas-subaccount.ts "<mercurioFilialLabel>" [--confirm]
 */
import { db } from "../src/lib/db";
import { asaasCreateSubaccount } from "../src/lib/asaas/client";
import { abrirDadosUnidade, abrirSessaoMercurio, lerDadosUnidade } from "../src/lib/mercurio/browser-session";
import { parseLogradouro } from "../src/lib/mercurio/parse-logradouro";

async function main() {
  const filialLabel = process.argv[2];
  const confirmar = process.argv.includes("--confirm");
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/create-asaas-subaccount.ts "<mercurioFilialLabel>" [--confirm]');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  if (school.asaasWalletId) {
    throw new Error(`${school.name} já tem subconta Asaas (walletId ${school.asaasWalletId}) — nada a fazer.`);
  }

  console.log(`Lendo Dados da Unidade real de ${school.name}...`);
  const { browser, page } = await abrirSessaoMercurio();
  let dados: Awaited<ReturnType<typeof lerDadosUnidade>>;
  try {
    const frame = await abrirDadosUnidade(page, new RegExp(filialLabel, "i"));
    dados = await lerDadosUnidade(frame);
  } finally {
    await browser.close();
  }

  const { street, number } = parseLogradouro(dados.endereco);
  const receitaPrevista = await db.contributionCompositionItem
    .aggregate({ where: { member: { schoolId: school.id, mercurioAtivo: true } }, _sum: { amount: true } })
    .then((r) => Number(r._sum.amount ?? 0));

  const payload = {
    name: dados.razaoSocial || school.name,
    cpfCnpj: dados.cnpj,
    email: dados.emailDiretor,
    mobilePhone: dados.telefone.replace(/\D/g, ""),
    incomeValue: receitaPrevista || 1000, // estimativa conservadora se ainda não tiver composição suficiente sincronizada
    address: street || dados.endereco,
    addressNumber: number || "0",
    province: dados.bairro,
    postalCode: dados.cep.replace(/\D/g, ""),
    companyType: "ASSOCIATION" as const,
  };

  console.log("\n=== Payload que seria enviado pro Asaas ===");
  console.log(payload);

  if (!confirmar) {
    console.log("\n(dry-run — nada foi criado. Rode de novo com --confirm depois de revisar os dados acima.)");
    return;
  }

  console.log("\nCriando subconta de verdade...");
  const subconta = await asaasCreateSubaccount(payload);
  console.log("\n✅ Subconta criada:", { id: subconta.id, walletId: subconta.walletId });
  if (subconta.accessToken?.value) {
    console.log(`⚠ apiKey da subconta (guardar se for gerenciar ela separadamente — não recuperável depois): ${subconta.accessToken.value}`);
  }

  await db.school.update({ where: { id: school.id }, data: { asaasWalletId: subconta.walletId } });
  console.log(`\n✅ School.asaasWalletId salvo — próximas cobranças dessa escola já vão dividir automaticamente.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
