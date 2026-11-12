/** Gera docs/propostas/Proposta-Piloto-Portal-2026-11.pdf a partir do HTML ao lado (12/11/2026). */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function main() {
  const html = path.resolve("docs/propostas/Proposta-Piloto-Portal-2026-11.html");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(html).href);
  await page.pdf({
    path: html.replace(/\.html$/, ".pdf"),
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="width:100%;font-size:7.5pt;color:#5c6b65;padding:0 18mm;display:flex;justify-content:space-between;font-family:Arial"><span>PROPOSTA PILOTO • 12/11/2026</span><span class="pageNumber"></span></div>',
    margin: { top: "18mm", bottom: "20mm", left: "18mm", right: "18mm" },
  });
  await browser.close();
  console.log("PDF gerado.");
}
main();
