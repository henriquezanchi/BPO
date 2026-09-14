/**
 * Teste EXPLORATÓRIO, só leitura, do Mercúrio — pra validar que dá pra puxar
 * dado real de um aluno (Luiz Henrique Zanchi Borges, matrícula 21596) antes
 * de integrar isso no Portal de verdade.
 *
 * NÃO preenche nem salva nada. Reaproveita a MESMA lógica de login de
 * scraper/mercurio.js (crm-agencia-na) pra não reinventar seletores já
 * validados em produção.
 *
 * IMPORTANTE (risco documentado no scraper original): a credencial do
 * Mercúrio é compartilhada entre todos os usuários/filiais — login
 * concorrente já corrompeu dado entre filiais antes. Por isso este script
 * SEMPRE confere a trava scraper_progresso antes de logar.
 *
 * Uso: npx tsx --env-file=.env.mercurio-test scripts/mercurio-read-test.ts
 */
import { chromium, type Frame, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const NOME_TESTE = /LUIZ HENRIQUE/i;
const LABEL_FILIAL = /barra do gar/i; // "GOIÂNIA UNIVERSITARIO: BARRA DO GARÇAS"
const URL_LOGIN = "https://mercurio.oinabn.com.br/";
const LIMITE_RODADA_ATIVA_MS = 5 * 60 * 1000;
const PASTA_SCREENSHOTS = "scripts/.mercurio-test-output";

const scraperSupabase = createClient(
  process.env.SCRAPER_SUPABASE_URL!,
  process.env.SCRAPER_SUPABASE_SERVICE_ROLE_KEY!,
);

async function verificarRodadaJaEmAndamento() {
  const { data } = await scraperSupabase.from("scraper_progresso").select("*").eq("id", "mercurio").maybeSingle();
  if (!data || data.concluido || !data.atualizado_em) return null;
  const idadeMs = Date.now() - new Date(data.atualizado_em).getTime();
  if (idadeMs > LIMITE_RODADA_ATIVA_MS) return null;
  return data;
}

async function lerCredencial(sistema: string, filial: string | null) {
  const { data, error } = await scraperSupabase.rpc("ler_credencial_scraper", {
    p_sistema: sistema,
    p_filial: filial || "GLOBAL",
    p_chave: process.env.CREDENCIAIS_SCRAPER_CHAVE,
  });
  if (error) throw new Error(`Erro ao ler credencial de ${sistema}: ${error.message}`);
  if (!data || data.length === 0) throw new Error(`Nenhuma credencial salva pra ${sistema}/${filial || "GLOBAL"}.`);
  return data[0] as { usuario: string; senha: string };
}

// ---- Copiado de scraper/mercurio.js (loginMercurio + auxiliares) ----

async function preencherComFallback(
  contexto: Page | Frame,
  getByLabelRegex: RegExp,
  seletorFallback: string,
  valor: string,
) {
  try {
    const campo = contexto.getByLabel(getByLabelRegex);
    await campo.waitFor({ timeout: 3000 });
    await campo.fill(valor);
    return;
  } catch {
    await contexto.locator(seletorFallback).first().fill(valor);
  }
}

async function acharContextoComTexto(page: Page, textoAlvo: string, timeoutMs = 10000): Promise<Page | Frame> {
  const fim = Date.now() + timeoutMs;
  while (Date.now() < fim) {
    if ((await page.getByText(textoAlvo, { exact: false }).count()) > 0) return page;
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        if ((await frame.getByText(textoAlvo, { exact: false }).count()) > 0) return frame;
      } catch {
        /* frame destruído entre checagem e uso */
      }
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`Não encontrei "${textoAlvo}" (timeout ${timeoutMs}ms).`);
}

async function esperarFrame(page: Page, nome: string, regexUrl: RegExp, timeoutMs = 10000): Promise<Frame> {
  const fim = Date.now() + timeoutMs;
  while (Date.now() < fim) {
    const frame = page.frame({ name: nome });
    if (frame && regexUrl.test(frame.url())) return frame;
    await page.waitForTimeout(200);
  }
  throw new Error(`Frame "${nome}" não chegou em ${regexUrl} a tempo.`);
}

async function loginMercurio(page: Page, matricula: string, senha: string) {
  await page.goto(URL_LOGIN, { waitUntil: "domcontentloaded" });
  const ctx = await acharContextoComTexto(page, "Matr", 15000);
  const SELETOR_CAMPO_TEXTO =
    'input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"])';
  await preencherComFallback(ctx, /matr[ií]cula/i, SELETOR_CAMPO_TEXTO, matricula);
  await preencherComFallback(ctx, /senha/i, 'input[type="password"]', senha);
  try {
    await ctx.getByRole("button", { name: /entrar/i }).click();
  } catch {
    await ctx.getByText("Entrar", { exact: false }).click();
  }
  await page.waitForURL(/ger_frame\.php/, { timeout: 20000 });
}

// ---- Copiado/adaptado de scraper/mercurio.js (navegação até a ficha) ----

async function listarLinksCadastro(page: Page) {
  const framePrincipal = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
  const links = framePrincipal.getByRole("link", { name: "CADASTRO", exact: true });
  const total = await links.count();
  const resultado: { label: string; indice: number }[] = [];
  for (let i = 0; i < total; i++) {
    let label = `filial_${i + 1}`;
    try {
      const tabelaMenu = links
        .nth(i)
        .locator('xpath=ancestor::table[contains(concat(" ", normalize-space(@class), " "), " menu ")][1]');
      const texto = (await tabelaMenu.locator("a.menu_tit").first().innerText()).replace(/\s+/g, " ").trim();
      if (texto) label = texto;
    } catch {
      /* mantém o rótulo genérico */
    }
    resultado.push({ label, indice: i });
  }
  return resultado;
}

// ---- Script principal ----

async function main() {
  fs.mkdirSync(PASTA_SCREENSHOTS, { recursive: true });

  console.log("Verificando se já existe uma rodada do scraper em andamento...");
  const rodadaAtiva = await verificarRodadaJaEmAndamento();
  if (rodadaAtiva) {
    console.error(
      `ABORTANDO: já existe uma rodada em andamento (${JSON.stringify(rodadaAtiva)}). Não vou logar pra evitar concorrência.`,
    );
    process.exit(1);
  }
  console.log("Nenhuma rodada ativa. Prosseguindo.");

  const httpAuth = await lerCredencial("mercurio_http", null);
  const { usuario: matricula, senha } = await lerCredencial("mercurio", null);
  console.log(`Credenciais obtidas (matrícula de login: ${matricula}).`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      httpCredentials: { username: httpAuth.usuario, password: httpAuth.senha },
    });
    const page = await context.newPage();

    console.log("Fazendo login no Mercúrio...");
    await loginMercurio(page, matricula, senha);
    console.log("Login OK.");
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/1-pos-login.png` });

    console.log(`Procurando o link CADASTRO da filial (${LABEL_FILIAL})...`);
    const cadastros = await listarLinksCadastro(page);
    console.log("Filiais encontradas:", cadastros.map((c) => c.label));
    const filial = cadastros.find((c) => LABEL_FILIAL.test(c.label));
    if (!filial) throw new Error(`Nenhuma filial batendo com ${LABEL_FILIAL} encontrada.`);

    const framePrincipal0 = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
    await framePrincipal0.getByRole("link", { name: "CADASTRO", exact: true }).nth(filial.indice).click();

    const frameIndice = await esperarFrame(page, "indice", /uni_indice\.php/, 15000);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/2-dentro-da-filial.png` });

    await frameIndice.getByText("Ativos", { exact: true }).click();
    const framePrincipalAtivos = await esperarFrame(page, "principal", /uni_newati\.php/, 15000);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/3-lista-ativos.png` });

    console.log(`Procurando "${NOME_TESTE}" na lista de Ativos...`);
    const linkNome = framePrincipalAtivos.getByRole("link", { name: NOME_TESTE }).first();
    await linkNome.waitFor({ timeout: 10000 });
    await linkNome.click();

    const framePrincipal = await esperarFrame(page, "principal", /uni_cadfun\.php/, 15000);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/4-ficha-aluno.png` });

    const resultado: Record<string, unknown> = {};
    try {
      resultado.nomeCompleto = (await framePrincipal.getByLabel(/^nome$/i).first().inputValue().catch(() => "")).trim();
    } catch {
      /* best-effort */
    }

    try {
      await framePrincipal.getByText(/^ENDERE[ÇC]OS$/i).first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${PASTA_SCREENSHOTS}/5-enderecos.png` });
      resultado.email = (await framePrincipal.getByLabel(/e-?mail/i).first().inputValue().catch(() => "")).trim();
      resultado.cidade = (await framePrincipal.getByLabel(/^cidade$/i).first().inputValue().catch(() => "")).trim();
      resultado.uf = (await framePrincipal.getByLabel(/^uf$/i).first().inputValue().catch(() => "")).trim();
      resultado.telefoneAlternativo = (
        await framePrincipal.getByLabel(/alternativo/i).first().inputValue().catch(() => "")
      ).trim();
    } catch (e) {
      console.warn("Falha ao ler ENDEREÇOS:", (e as Error).message);
    }

    console.log("\n=== Resultado ===");
    console.log(JSON.stringify(resultado, null, 2));
    console.log(`\nScreenshots salvos em ${PASTA_SCREENSHOTS}/`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
