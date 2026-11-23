/**
 * Passo a passo para os membros (23/11/2026): gera, a partir de docs/guias/passo-a-passo-membros.html,
 *  - public/guia-membros.pdf  (A4)
 *  - public/guia-membros.png  (imagem única para o WhatsApp)
 *  - public/guia-membros.mp4  (vídeo vertical 1080×1920 com narração e trilha: scripts/video-guia-membros.py)
 * Requisitos: Playwright (já no projeto), Python com edge-tts e numpy, e ffmpeg (FFMPEG=<caminho> ou no PATH).
 * Uso: npx tsx scripts/gerar-guia-membros.ts
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FONTE = pathToFileURL(path.resolve("docs/guias/passo-a-passo-membros.html")).href;
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const QUADROS = 8; // capa, 6 passos, final

async function main() {
  const browser = await chromium.launch();

  const pdf = await browser.newPage();
  await pdf.goto(`${FONTE}?f=pdf`);
  await pdf.pdf({ path: "public/guia-membros.pdf", format: "A4", printBackground: true, margin: { top: "0", bottom: "12mm", left: "0", right: "0" } });

  const img = await browser.newPage({ viewport: { width: 1080, height: 1000 } });
  await img.goto(`${FONTE}?f=img`);
  await img.screenshot({ path: "public/guia-membros.png", fullPage: true });

  const pasta = path.join(os.tmpdir(), "guia-membros-quadros");
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(pasta, { recursive: true });
  const q = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  for (let n = 0; n < QUADROS; n++) {
    await q.goto(`${FONTE}?f=quadro&n=${n}`);
    await q.screenshot({ path: path.join(pasta, `q${n}.png`) });
  }
  await browser.close();

  execFileSync("python", ["scripts/video-guia-membros.py", pasta, FFMPEG], { stdio: "inherit" });
  console.log("Gerados: public/guia-membros.pdf, .png e .mp4");
}
main();
