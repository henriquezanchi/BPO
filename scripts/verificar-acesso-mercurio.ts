/**
 * Quais escolas do piloto o login do robô do Mercúrio enxerga (12/11/2026). Só leitura: entra, lista os menus de
 * CADASTRO e TESOURARIA e compara com as escolas do escopo (lib/spread.ts). Rodar depois de trocar a credencial
 * (MERCURIO_ROBO_MATRICULA / MERCURIO_ROBO_SENHA) e sempre que novas filiais forem liberadas para o login:
 *   npx tsx scripts/verificar-acesso-mercurio.ts
 * Contexto: o Mercúrio atual não terá acesso de escrita por API; até o Mercúrio novo (fevereiro/2027), os lançamentos
 * das escolas do piloto saem pelo navegador automatizado, com o login do usuário.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { abrirSessaoMercurioComRetry, listarLinksMenu } from "../src/lib/mercurio/browser-session";
import { ESCOPO_PILOTO } from "../src/lib/spread";

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function main() {
  const escolas = await db.school.findMany({ where: { mercurioUnidade: { in: ESCOPO_PILOTO } }, select: { mercurioUnidade: true, name: true, mercurioFilialLabel: true, mercurioEscrita: true } });
  const { browser, page } = await abrirSessaoMercurioComRetry();
  try {
    const cadastros = (await listarLinksMenu(page, "CADASTRO")).map((c) => c.label);
    const tesourarias = (await listarLinksMenu(page, "TESOURARIA")).map((c) => c.label);
    console.log(`Filiais no menu CADASTRO (${cadastros.length}): ${cadastros.join(" | ")}`);
    console.log(`Filiais no menu TESOURARIA (${tesourarias.length}): ${tesourarias.join(" | ")}\n`);
    for (const u of ESCOPO_PILOTO) {
      const e = escolas.find((x) => x.mercurioUnidade === u);
      const regex = e?.mercurioFilialLabel ? new RegExp(e.mercurioFilialLabel, "i") : null;
      const nome = e ? sem(e.name.replace(/^Nova Acr[oó]pole\s*-\s*/i, "")) : u.toLowerCase();
      const cad = cadastros.find((l) => (regex ? regex.test(l) : sem(l).includes(nome)));
      const tes = tesourarias.find((l) => (regex ? regex.test(l) : sem(l).includes(nome)));
      console.log(
        `${u.padEnd(4)} ${(e?.name ?? "(fora do Portal)").padEnd(45)} rótulo=${e?.mercurioFilialLabel ?? "—"} · cadastro=${cad ? "OK" : "NÃO"} · tesouraria=${tes ? "OK" : "NÃO"} · escrita=${e?.mercurioEscrita ? "ligada" : "desligada"}`,
      );
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => console.error("ERRO", (e as Error).message)).finally(() => process.exit(0));
