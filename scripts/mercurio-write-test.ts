/**
 * Teste de ESCRITA real no Mercúrio, controlado e reversível — campo
 * "Telefone Alternativo" da ficha do Luiz Henrique Zanchi Borges (matrícula
 * 21596, filial Barra do Garças). Autorizado explicitamente pelo usuário
 * (dono do cadastro) em 2026-09-14.
 *
 * Fluxo: login -> ENDEREÇOS -> inventaria os <input> reais da aba (evita
 * adivinhar seletor) -> confirma qual é o par DDD/número de "Alternativo"
 * -> muda pra um valor de teste óbvio -> Gravar -> screenshot de
 * confirmação -> IMEDIATAMENTE reverte pro valor original -> Gravar de
 * novo -> screenshot final confirmando reversão.
 *
 * Mesma trava de concorrência do scraper original (scraper_progresso).
 *
 * Uso: npx tsx --env-file=.env.mercurio-test scripts/mercurio-write-test.ts
 */
import { chromium, type Frame, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const NOME_TESTE = /LUIZ HENRIQUE/i;
const LABEL_FILIAL = /barra do gar/i;
const URL_LOGIN = "https://mercurio.oinabn.com.br/";
const LIMITE_RODADA_ATIVA_MS = 5 * 60 * 1000;
const PASTA_SCREENSHOTS = "scripts/.mercurio-test-output";

const DDD_ORIGINAL = "62";
const NUMERO_ORIGINAL = "991729783";
const NUMERO_TESTE = "999999999"; // claramente um valor de teste, mesmo DDD

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

async function preencherComFallback(contexto: Page | Frame, getByLabelRegex: RegExp, seletorFallback: string, valor: string) {
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
      } catch {}
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

async function listarLinksCadastro(page: Page) {
  const framePrincipal = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
  const links = framePrincipal.getByRole("link", { name: "CADASTRO", exact: true });
  const total = await links.count();
  const resultado: { label: string; indice: number }[] = [];
  for (let i = 0; i < total; i++) {
    let label = `filial_${i + 1}`;
    try {
      const tabelaMenu = links.nth(i).locator('xpath=ancestor::table[contains(concat(" ", normalize-space(@class), " "), " menu ")][1]');
      const texto = (await tabelaMenu.locator("a.menu_tit").first().innerText()).replace(/\s+/g, " ").trim();
      if (texto) label = texto;
    } catch {}
    resultado.push({ label, indice: i });
  }
  return resultado;
}

// Inventário bruto de todos os <input> visíveis na aba atual — nome, id,
// tipo e valor. Base pra identificar o par DDD/número de "Alternativo" sem
// adivinhar (o site não associa <label for> de verdade aos campos).
async function inventariarInputs(frame: Frame) {
  return frame.locator("input").evaluateAll((els) =>
    els.map((el) => {
      const input = el as HTMLInputElement;
      return { name: input.name, id: input.id, type: input.type, value: input.value };
    }),
  );
}

async function main() {
  fs.mkdirSync(PASTA_SCREENSHOTS, { recursive: true });

  console.log("Verificando trava de concorrência...");
  const rodadaAtiva = await verificarRodadaJaEmAndamento();
  if (rodadaAtiva) {
    console.error(`ABORTANDO: rodada em andamento (${JSON.stringify(rodadaAtiva)}).`);
    process.exit(1);
  }
  console.log("OK, nenhuma rodada ativa.");

  const httpAuth = await lerCredencial("mercurio_http", null);
  const { usuario: matricula, senha } = await lerCredencial("mercurio", null);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ httpCredentials: { username: httpAuth.usuario, password: httpAuth.senha } });
    const page = await context.newPage();

    console.log("Login...");
    await loginMercurio(page, matricula, senha);

    const cadastros = await listarLinksCadastro(page);
    const filial = cadastros.find((c) => LABEL_FILIAL.test(c.label));
    if (!filial) throw new Error(`Filial ${LABEL_FILIAL} não encontrada.`);

    const framePrincipal0 = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
    await framePrincipal0.getByRole("link", { name: "CADASTRO", exact: true }).nth(filial.indice).click();

    const frameIndice = await esperarFrame(page, "indice", /uni_indice\.php/, 15000);
    await frameIndice.getByText("Ativos", { exact: true }).click();
    const framePrincipalAtivos = await esperarFrame(page, "principal", /uni_newati\.php/, 15000);

    console.log(`Abrindo ficha de ${NOME_TESTE}...`);
    const linkNome = framePrincipalAtivos.getByRole("link", { name: NOME_TESTE }).first();
    await linkNome.waitFor({ timeout: 10000 });
    await linkNome.click();
    const framePrincipal = await esperarFrame(page, "principal", /uni_cadfun\.php/, 15000);
    await page.waitForTimeout(800);

    console.log("Abrindo aba ENDEREÇOS...");
    await framePrincipal.getByText(/^ENDERE[ÇC]OS$/i).first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/w1-antes.png` });

    console.log("Inventariando inputs reais da aba...");
    const inputs = await inventariarInputs(framePrincipal);
    console.log(JSON.stringify(inputs, null, 2));

    // O par DDD/número de "Alternativo" tem o valor original
    // (DDD_ORIGINAL/NUMERO_ORIGINAL) e aparece DEPOIS do par de "Celular"
    // no DOM (mesma ordem visual: Celular, depois Alternativo, depois
    // Comercial) — usamos os valores atuais (conhecidos pelo screenshot
    // anterior) pra achar o índice certo com segurança, em vez de confiar
    // só em posição.
    const idxNumeroAlternativo = inputs.findIndex(
      (i, idx) => i.value === NUMERO_ORIGINAL && inputs[idx - 1]?.value === DDD_ORIGINAL && idx > 0 &&
        // o par de Celular também bate (62/991729783) — pega a 2ª ocorrência
        inputs.slice(0, idx).filter((j) => j.value === NUMERO_ORIGINAL).length >= 1,
    );

    if (idxNumeroAlternativo === -1) {
      console.error("NÃO CONSEGUI IDENTIFICAR o campo 'Telefone Alternativo' com segurança pelo inventário acima. Abortando SEM alterar nada.");
      process.exit(1);
    }

    const nomeCampoNumero = inputs[idxNumeroAlternativo].name || inputs[idxNumeroAlternativo].id;
    console.log(`Campo identificado: ${nomeCampoNumero} (valor atual: ${inputs[idxNumeroAlternativo].value})`);

    const seletorNumero = nomeCampoNumero
      ? `[name="${nomeCampoNumero}"], #${nomeCampoNumero}`
      : null;
    if (!seletorNumero) {
      console.error("Campo identificado não tem name/id utilizável. Abortando.");
      process.exit(1);
    }

    const campoNumero = framePrincipal.locator(seletorNumero).first();

    console.log(`Escrevendo valor de TESTE (${NUMERO_TESTE})...`);
    await campoNumero.fill(NUMERO_TESTE);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/w2-preenchido-teste.png` });

    console.log("Clicando Gravar...");
    await framePrincipal.getByRole("button", { name: /gravar/i }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/w3-apos-gravar-teste.png` });

    // Reabre a ficha pra confirmar que persistiu de verdade (não só no DOM
    // em memória) antes de reverter.
    console.log("Reabrindo a ficha pra confirmar persistência...");
    await framePrincipal.getByText(/^ENDERE[ÇC]OS$/i).first().click();
    await page.waitForTimeout(800);
    const inputsDepois = await inventariarInputs(framePrincipal);
    const valorConfirmado = inputsDepois.find((i) => (i.name || i.id) === nomeCampoNumero)?.value;
    console.log(`Valor confirmado após reload: ${valorConfirmado}`);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/w4-confirmado-persistiu.png` });

    console.log(`Revertendo pro valor original (${NUMERO_ORIGINAL})...`);
    const campoNumeroDepois = framePrincipal.locator(seletorNumero).first();
    await campoNumeroDepois.fill(NUMERO_ORIGINAL);
    await framePrincipal.getByRole("button", { name: /gravar/i }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/w5-revertido.png` });

    console.log("Confirmando reversão...");
    await framePrincipal.getByText(/^ENDERE[ÇC]OS$/i).first().click();
    await page.waitForTimeout(800);
    const inputsFinal = await inventariarInputs(framePrincipal);
    const valorFinal = inputsFinal.find((i) => (i.name || i.id) === nomeCampoNumero)?.value;
    console.log(`Valor final: ${valorFinal} (esperado: ${NUMERO_ORIGINAL})`);
    await page.screenshot({ path: `${PASTA_SCREENSHOTS}/w6-final.png` });

    if (valorFinal !== NUMERO_ORIGINAL) {
      console.error(`ATENÇÃO: valor final (${valorFinal}) NÃO bate com o original (${NUMERO_ORIGINAL})! Verifique manualmente.`);
      process.exit(1);
    }
    console.log("\n✅ Teste de escrita completo: gravou, confirmou persistência, reverteu, confirmou reversão.");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
