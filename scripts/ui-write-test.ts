/**
 * Testa o caminho de escrita EXATAMENTE como um usuário real usaria: abre
 * o Portal rodando em localhost, clica "Editar Dados", muda o e-mail,
 * clica "Salvar Alterações" (dispara a Server Action de verdade, que
 * escreve no Mercúrio de verdade), confirma o retorno na tela, e reverte.
 *
 * Uso: npx tsx --env-file=.env scripts/ui-write-test.ts <memberId> <baseUrl?>
 */
import { chromium } from "playwright";

async function main() {
  const memberId = process.argv[2];
  const baseUrl = process.argv[3] || "http://localhost:3000";
  if (!memberId) throw new Error("Uso: npx tsx scripts/ui-write-test.ts <memberId>");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/portal?memberId=${memberId}`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /editar dados/i }).click();
    await page.waitForTimeout(500);

    const emailInput = page.locator('input[name="email"]');
    const emailOriginal = await emailInput.inputValue();
    console.log(`E-mail original no formulário: ${emailOriginal}`);

    await emailInput.fill("teste-integracao-portal@example.com");
    await page.getByRole("button", { name: /salvar altera/i }).click();

    console.log("Aguardando a Server Action (login + escrita no Mercúrio)...");
    await page.getByText(/dados atualizados com sucesso/i).waitFor({ timeout: 60000 });
    const mensagem = await page.getByText(/dados atualizados com sucesso/i).innerText();
    console.log(`Mensagem exibida: "${mensagem}"`);
    await page.screenshot({ path: "scripts/.mercurio-test-output/ui-1-salvo.png" });

    console.log("\nRevertendo pro e-mail original...");
    await emailInput.fill(emailOriginal);
    await page.getByRole("button", { name: /salvar altera/i }).click();
    await page.getByText(/dados atualizados com sucesso/i).waitFor({ timeout: 60000 });
    console.log("Revertido.");
    await page.screenshot({ path: "scripts/.mercurio-test-output/ui-2-revertido.png" });

    console.log("\n✅ Teste via UI real completo.");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
