import { oldestOpenContribution } from "@/lib/contribution-order";
import { db } from "@/lib/db";
import { pendenciaVencida } from "@/lib/pendencias-comum";
export { pendenciaVencida } from "@/lib/pendencias-comum";
import { abrirSessaoMercurio, abrirTelaRecibos, resetarNavegacao } from "@/lib/mercurio/browser-session";
import type { Page } from "playwright";

/**
 * Pendências da Tesouraria do Mercúrio (26/11/2026, pedido do usuário): "Tesouraria → Cadastro → Pendentes"
 * (tesoura/tes_penlst.php) é onde a escola registra o que o aluno deve além da contribuição (lanchonete, multa da
 * biblioteca, negociação de dívida antiga, produtos). A pendência sai no recibo junto com a contribuição e some da
 * lista quando é paga. A tela não tem matrícula: só nome, vencimento (MM/AAAA), rubrica + descrição, valor e
 * responsável, e o id interno no link de exclusão (pen=NNN). Mapeado ao vivo em 26/11/2026, só leitura.
 *
 * Guardado em ResumoNacional "pendencias-mercurio:<UNI>" (sem tabela nova); o membro é casado pelo nome
 * normalizado dentro da filial. Nada é gravado no Mercúrio.
 */
export interface PendenciaMercurio {
  id: string; // pen=NNN do Mercúrio
  nome: string;
  vencimento: string; // "MM/AAAA"
  rubrica: string;
  descricao: string;
  valor: number;
  responsavel: string;
}

export interface PendenciasFilial {
  lidoEm: string;
  itens: PendenciaMercurio[];
}

const CHAVE = (uni: string) => `pendencias-mercurio:${uni}`;
const URL_PENDENTES = "https://mercurio.oinabn.com.br/tesoura/tes_penlst.php";

export const normalizarNome = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

/** Pendências em aberto de uma pessoa (casadas pelo nome dentro da filial). */
export async function pendenciasDoMembro(member: { name: string; school: { mercurioUnidade: string | null } }): Promise<{ lidoEm: string | null; itens: PendenciaMercurio[] }> {
  if (!member.school.mercurioUnidade) return { lidoEm: null, itens: [] };
  const linha = await db.resumoNacional.findUnique({ where: { chave: CHAVE(member.school.mercurioUnidade) } });
  const dados = linha?.dados as PendenciasFilial | undefined;
  if (!dados?.itens?.length) return { lidoEm: dados?.lidoEm ?? null, itens: [] };
  const alvo = normalizarNome(member.name);
  return { lidoEm: dados.lidoEm, itens: dados.itens.filter((p) => normalizarNome(p.nome) === alvo) };
}

/**
 * Pendências que entram na cobrança da contribuição de (year, month) pelo Portal (26/11/2026, "construir o caminho"):
 * mapeado ao vivo na tela do recibo (tes_universal7.php): "CONTRIBUIÇÃO E ACERTOS PENDENTES" lista as pendências vencidas
 * SEM caixa de marcação e o Mercúrio as inclui sozinho no primeiro recibo emitido. Então elas só podem ser pagas junto
 * com o mês mais antigo em aberto, e o valor cobrado pelo Portal precisa somá-las, senão o robô encontra um total maior
 * que o pago e o lançamento cai na fila de exceção.
 */
export async function pendenciasNaCobranca(
  member: { id: string; name: string; school: { mercurioUnidade: string | null } },
  year: number,
  month: number,
): Promise<PendenciaMercurio[]> {
  const { itens } = await pendenciasDoMembro(member);
  const vencidas = itens.filter((p) => pendenciaVencida(p));
  if (!vencidas.length) return [];
  const [monthly, charges] = await Promise.all([
    db.contributionMonthlyStatus.findMany({ where: { memberId: member.id }, select: { year: true, month: true, status: true } }),
    db.paymentCharge.findMany({ where: { memberId: member.id }, select: { referenceYear: true, referenceMonth: true, status: true } }),
  ]);
  const maisAntigo = oldestOpenContribution(monthly, charges);
  // Sem mês em aberto conhecido, o mês pedido é o primeiro recibo: as pendências entram nele.
  if (maisAntigo && (maisAntigo.year !== year || maisAntigo.month !== month)) return [];
  return vencidas;
}
