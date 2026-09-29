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
 * Usa @next/env (não --env-file/dotenv) porque ASAAS_API_KEY no .env vem
 * escapado (`\$aact_prod_...`) especificamente pra expansão do Next —
 * outros loaders mandam a chave quebrada, com a barra invertida incluída
 * (confirmado ao vivo: 401 "chave de API inválida"). Import dinâmico
 * DEPOIS do loadEnvConfig — import estático seria hoisted pro topo do
 * arquivo (antes do loadEnvConfig rodar), quebrando db.ts (lê
 * DATABASE_URL de cara, no module load).
 *
 * Uso: npx tsx scripts/create-asaas-subaccount.ts "<mercurioFilialLabel>" [--confirm] [--email=<email>] [--phone=<celular>]
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import("../src/lib/db");
  const { asaasCreateSubaccount } = await import("../src/lib/asaas/client");
  const { abrirDadosUnidade, abrirSessaoMercurio, lerDadosUnidade } = await import("../src/lib/mercurio/browser-session");
  const { parseLogradouro } = await import("../src/lib/mercurio/parse-logradouro");

  const filialLabel = process.argv[2];
  const confirmar = process.argv.includes("--confirm");
  const emailOverride = process.argv.find((a) => a.startsWith("--email="))?.slice("--email=".length);
  const phoneOverride = process.argv.find((a) => a.startsWith("--phone="))?.slice("--phone=".length);
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/create-asaas-subaccount.ts "<mercurioFilialLabel>" [--confirm] [--email=<email>] [--phone=<celular>]');

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
    email: emailOverride || dados.emailDiretor,
    mobilePhone: (phoneOverride ?? dados.telefone).replace(/\D/g, ""),
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

  // O Asaas só entrega essa chave 1x, nesta resposta — se não salvar agora,
  // não tem como recuperar depois (só regenerando, invalidando a antiga).
  await db.school.update({
    where: { id: school.id },
    data: { asaasWalletId: subconta.walletId, asaasSubaccountApiKey: subconta.accessToken?.value ?? null },
  });
  console.log(`\n✅ School.asaasWalletId salvo — próximas cobranças dessa escola já vão dividir automaticamente.`);
  console.log(subconta.accessToken?.value ? "✅ apiKey da subconta salva em School.asaasSubaccountApiKey." : "⚠ Asaas não retornou apiKey — emitir cobrança pela subconta vai precisar gerar uma depois.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
