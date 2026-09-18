/**
 * Lista os nomes reais dos Caixas cadastrados numa filial (Tesouraria >
 * Caixas) — só leitura, sem risco nenhum. Usar pra decidir o valor de
 * School.mercurioCaixaLancamento (precisa bater EXATO com o nome mostrado
 * aqui) antes de habilitar o lançamento automático de contribuição.
 *
 * Uso: npx tsx --env-file=.env scripts/list-cashiers.ts "<mercurioFilialLabel>"
 */
import { abrirSessaoMercurio, listarCaixas } from "../src/lib/mercurio/browser-session";

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/list-cashiers.ts "<mercurioFilialLabel>"');

  const { browser, page } = await abrirSessaoMercurio();
  try {
    const caixas = await listarCaixas(page, new RegExp(filialLabel, "i"));
    console.log("Caixas encontrados:");
    caixas.forEach((c) => console.log(`  - "${c}"`));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
