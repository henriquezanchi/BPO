/**
 * Mesmo padrão de scripts/ui-write-test.ts, pra página /portal/mais-dados:
 * abre a página de verdade, muda "Profissão", salva (dispara a Server
 * Action real, que escreve no Mercúrio), confirma, reverte.
 *
 * Uso: npx tsx --env-file=.env scripts/ui-mais-dados-write-test.ts <memberId> <baseUrl?>
 */
import { chromium } from "playwright";

async function main() {
  const memberId = process.argv[2];
  const baseUrl = process.argv[3] || "http://localhost:3000";
  if (!memberId) throw new Error("Uso: npx tsx scripts/ui-mais-dados-write-test.ts <memberId>");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/portal/mais-dados?memberId=${memberId}`, { waitUntil: "networkidle" });

    const profInput = page.locator('input[name="profession"]');
    const profOriginal = await profInput.inputValue();
    console.log(`Profissão original: ${profOriginal}`);

    await profInput.fill("ESCRITOR/REDATOR (TESTE INTEGRAÇÃO)");
    await page.getByRole("button", { name: /salvar altera/i }).click();

    console.log("Aguardando a Server Action (login + escrita no Mercúrio)...");
    await page.getByText(/dados atualizados com sucesso/i).waitFor({ timeout: 60000 });
    console.log(`Mensagem: "${await page.getByText(/dados atualizados com sucesso/i).innerText()}"`);
    await page.screenshot({ path: "scripts/.mercurio-test-output/mais-dados-1-salvo.png" });

    console.log("\nRevertendo...");
    await page.locator('input[name="profession"]').fill(profOriginal);
    await page.getByRole("button", { name: /salvar altera/i }).click();
    await page.getByText(/dados atualizados com sucesso/i).waitFor({ timeout: 60000 });
    console.log("Revertido.");
    await page.screenshot({ path: "scripts/.mercurio-test-output/mais-dados-2-revertido.png" });

    console.log("\n✅ Teste via UI real (Mais Dados) completo.");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
