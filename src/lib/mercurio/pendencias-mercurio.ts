import { db } from "@/lib/db";
import { abrirSessaoMercurio, abrirTelaRecibos, resetarNavegacao } from "@/lib/mercurio/browser-session";
import type { Page } from "playwright";
import { CHAVE, type PendenciaMercurio, type PendenciasFilial } from "@/lib/pendencias-dados";
export * from "@/lib/pendencias-dados";

const URL_PENDENTES = "https://mercurio.oinabn.com.br/tesoura/tes_penlst.php";

/** Lê a lista "Pendências em Aberto" da filial já aberta na Tesouraria. */
export async function lerPendenciasFilial(page: Page, filialLabelRegex: RegExp): Promise<PendenciaMercurio[]> {
  const frame = await abrirTelaRecibos(page, filialLabelRegex);
  await frame.goto(URL_PENDENTES, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  return frame.evaluate(() => {
    const tabela = [...document.querySelectorAll("table")].find((t) => /^\s*Nome\s*$/.test(t.querySelector("th")?.textContent ?? ""));
    if (!tabela) return [];
    const linhas = [...tabela.querySelectorAll("tr")].slice(1);
    return linhas
      .map((tr) => {
        const td = [...tr.querySelectorAll("td")];
        if (td.length < 5) return null;
        const desc = td[2].innerHTML.split(/<br\s*\/?>/i).map((x) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
        const link = td[5]?.querySelector("a")?.getAttribute("href") ?? "";
        const id = link.match(/pen=(\d+)/)?.[1] ?? "";
        return {
          id,
          nome: td[0].textContent!.replace(/\s+/g, " ").trim(),
          vencimento: td[1].textContent!.trim(),
          rubrica: desc[0] ?? "",
          descricao: desc.slice(1).join(" ").trim(),
          // O Mercúrio mostra "840.00" (ponto decimal); se vier "1.234,56", converte do formato brasileiro.
          valor: (() => {
            const t = td[3].textContent!.trim();
            return /,\d{1,2}$/.test(t) ? Number(t.replace(/\./g, "").replace(",", ".")) || 0 : Number(t) || 0;
          })(),
          responsavel: td[4].textContent!.replace(/\s+/g, " ").trim(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x && !!x.id);
  });
}

/** Lê as pendências de todas as filiais com rótulo do Mercúrio configurado e guarda por filial. */
export async function sincronizarPendenciasMercurio(): Promise<{ uni: string; itens: number }[]> {
  const escolas = await db.school.findMany({
    where: { mercurioUnidade: { not: null }, mercurioFilialLabel: { not: null }, sistemaRegistro: { not: "mercury" } },
    select: { id: true, mercurioUnidade: true, mercurioFilialLabel: true, name: true },
  });
  const { browser, page } = await abrirSessaoMercurio();
  const resultado: { uni: string; itens: number }[] = [];
  try {
    for (const e of escolas) {
      try {
        // Volta à tela "Funções do Sistema" antes de cada filial (dentro da Tesouraria o frame principal não acha
        // o menu de novo).
        await resetarNavegacao(page);
        const itens = await lerPendenciasFilial(page, new RegExp(e.mercurioFilialLabel!, "i"));
        const dados: PendenciasFilial = { lidoEm: new Date().toISOString(), itens };
        await db.resumoNacional.upsert({
          where: { chave: CHAVE(e.mercurioUnidade!) },
          update: { dados: JSON.parse(JSON.stringify(dados)), geradoEm: new Date() },
          create: { chave: CHAVE(e.mercurioUnidade!), dados: JSON.parse(JSON.stringify(dados)) },
        });
        resultado.push({ uni: e.mercurioUnidade!, itens: itens.length });
      } catch (err) {
        // Login sem TESOURARIA nessa filial (normal: o robô só administra algumas) ou tela diferente: segue.
        const msg = (err as Error).message;
        if (!/sem link de TESOURARIA/.test(msg)) console.error(`[pendencias-mercurio] ${e.mercurioUnidade}:`, msg.slice(0, 200));
      }
    }
  } finally {
    await browser.close();
  }
  return resultado;
}

