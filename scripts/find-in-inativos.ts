/**
 * Busca um membro pontual na lista de Inativos de uma filial (Glaubia Rocha
 * Barbosa Relvas, 2026-09-30: virou Círculo de Amigos mas antes disso
 * precisa levar baixa como membro no Mercúrio — o usuário disse que ela
 * pode já estar em Inativos). Só lê e liga o registro local existente
 * (mercurioId/registrationNo) — NÃO sincroniza composição nem endereço,
 * já que ela ainda não é Círculo de Amigos de verdade lá (isso só acontece
 * quando o usuário fizer a inclusão no mês que vem).
 *
 * Uso: npx tsx --env-file=.env scripts/find-in-inativos.ts "<mercurioFilialLabel>" "<nome ou trecho do nome>"
 */
import { db } from "../src/lib/db";
import { abrirFichaDaListaAtivos, abrirListaInativos, abrirSessaoMercurio, lerAbaEnderecos } from "../src/lib/mercurio/browser-session";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A lista de Inativos (unidade/uni_cadlis.php) tem colunas diferentes de
 * Ativos/C. de Amigos — "Nome | Telefones | Ni | Data | Motivo", SEM coluna
 * "Matr" própria (confirmado ao vivo, 2026-09-30) — então não dá pra
 * reaproveitar listarAtivosResumo aqui.
 */
async function listarInativos(frame: Awaited<ReturnType<typeof abrirListaInativos>>) {
  return frame.evaluate(() => {
    const tabela = Array.from(document.querySelectorAll("table")).find((t) => {
      const cabecalhos = Array.from(t.rows[0]?.cells ?? []).map((c) => (c as HTMLElement).innerText.trim());
      return cabecalhos.includes("Nome") && cabecalhos.includes("Motivo");
    });
    if (!tabela) return [];
    return Array.from(tabela.rows)
      .slice(1)
      .map((linha) => {
        const celulas = Array.from(linha.cells);
        const nome = (celulas[0] as HTMLElement | undefined)?.innerText.trim() ?? "";
        const data = (celulas[3] as HTMLElement | undefined)?.innerText.trim() ?? "";
        const motivo = (celulas[4] as HTMLElement | undefined)?.innerText.trim() ?? "";
        return { nome, data, motivo };
      })
      .filter((i) => i.nome);
  });
}

async function main() {
  const filialLabel = process.argv[2];
  const nomeAlvo = process.argv[3];
  if (!filialLabel || !nomeAlvo) {
    throw new Error('Uso: npx tsx scripts/find-in-inativos.ts "<mercurioFilialLabel>" "<nome ou trecho do nome>"');
  }

  const { browser, page } = await abrirSessaoMercurio();
  try {
    const frame = await abrirListaInativos(page, new RegExp(filialLabel, "i"));
    const inativos = await listarInativos(frame);
    console.log(`Inativos encontrados no Mercúrio: ${inativos.length}`);

    const regexAlvo = new RegExp(escapeRegex(nomeAlvo), "i");
    const achados = inativos.filter((i) => regexAlvo.test(i.nome));
    console.log(`Batendo com "${nomeAlvo}":`, achados);

    if (achados.length === 1) {
      const frameFicha = await abrirFichaDaListaAtivos(page, frame, new RegExp(escapeRegex(achados[0].nome), "i"));
      const dados = await lerAbaEnderecos(frameFicha);
      console.log("Ficha:", dados);
    }
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
