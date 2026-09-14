/**
 * Automação de navegador (Playwright) do Mercúrio (mercurio.oinabn.com.br)
 * — não há API oficial, é RPA mesmo. Lógica de login/navegação
 * originalmente escrita e validada em scraper/mercurio.js (repo
 * crm-agencia-na) e reaproveitada aqui; a leitura/escrita da aba ENDEREÇOS
 * foi validada ao vivo em 2026-09-14 (ver histórico de conversa) contra o
 * cadastro real do Luiz Henrique Zanchi Borges (matrícula 21596).
 *
 * Nomes reais dos campos da aba ENDEREÇOS (confirmados via inventário ao
 * vivo, o site NÃO associa <label for> de verdade aos inputs):
 *   txtlog    = Logradouro (rua + número + complemento, tudo 1 campo só)
 *   txtbai    = Bairro
 *   txtcida   = Cidade
 *   txtuf     = UF
 *   txtcep    = CEP
 *   txtemail  = E-mail
 *   txtddd  + txtfone = DDD + número do "Celular" (1º par, confirmado ao
 *                        vivo por print do usuário — é o telefone principal)
 *   txtcddd + txtcel  = DDD + número do "Alternativo" (2º par)
 *   cmdGravar = botão Gravar (input[type=submit])
 */
import { chromium, type Browser, type Frame, type Page } from "playwright";
import { lerCredencialMercurio, verificarRodadaJaEmAndamento } from "./scraper-credentials";

const URL_LOGIN = "https://mercurio.oinabn.com.br/";

export class RodadaEmAndamentoError extends Error {}

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
    } catch {
      /* mantém o rótulo genérico */
    }
    resultado.push({ label, indice: i });
  }
  return resultado;
}

export interface SessaoMercurio {
  browser: Browser;
  page: Page;
}

/**
 * Abre uma sessão logada no Mercúrio. SEMPRE checa a trava de concorrência
 * primeiro — lança RodadaEmAndamentoError se houver uma rodada do scraper
 * agendado em andamento, pra nunca logar 2x ao mesmo tempo (risco real de
 * corromper dado entre filiais).
 */
export async function abrirSessaoMercurio(): Promise<SessaoMercurio> {
  const rodadaAtiva = await verificarRodadaJaEmAndamento();
  if (rodadaAtiva) {
    throw new RodadaEmAndamentoError(
      `Rodada do scraper em andamento (filial "${rodadaAtiva.filial}", etapa "${rodadaAtiva.etapa}") — não é seguro logar agora.`,
    );
  }

  const httpAuth = await lerCredencialMercurio("mercurio_http");
  const { usuario: matricula, senha } = await lerCredencialMercurio("mercurio");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ httpCredentials: { username: httpAuth.usuario, password: httpAuth.senha } });
  const page = await context.newPage();
  await loginMercurio(page, matricula, senha);
  return { browser, page };
}

/**
 * Navega até a ficha de um aluno (aba ENDEREÇOS já aberta), a partir de
 * uma sessão logada. `filialLabelRegex` identifica a filial (School.
 * mercurioFilialLabel) e `nomeRegex` identifica o aluno na lista de Ativos
 * — o Mercúrio não permite navegação direta por URL com matrícula (URL
 * fixa exige ter entrado pela filial certa primeiro, confirmado ao vivo:
 * "File not found" ao tentar direto).
 */
export async function abrirFichaEmEnderecos(page: Page, filialLabelRegex: RegExp, nomeRegex: RegExp): Promise<Frame> {
  const cadastros = await listarLinksCadastro(page);
  const filial = cadastros.find((c) => filialLabelRegex.test(c.label));
  if (!filial) {
    throw new Error(`Filial batendo com ${filialLabelRegex} não encontrada entre: ${cadastros.map((c) => c.label).join(", ")}`);
  }

  const framePrincipal0 = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
  await framePrincipal0.getByRole("link", { name: "CADASTRO", exact: true }).nth(filial.indice).click();

  const frameIndice = await esperarFrame(page, "indice", /uni_indice\.php/, 15000);
  await frameIndice.getByText("Ativos", { exact: true }).click();
  const framePrincipalAtivos = await esperarFrame(page, "principal", /uni_newati\.php/, 15000);

  const linkNome = framePrincipalAtivos.getByRole("link", { name: nomeRegex }).first();
  await linkNome.waitFor({ timeout: 10000 });
  await linkNome.click();

  const framePrincipal = await esperarFrame(page, "principal", /uni_cadfun\.php/, 15000);
  await page.waitForTimeout(800);
  await framePrincipal.getByText(/^ENDERE[ÇC]OS$/i).first().click();
  await page.waitForTimeout(800);
  return framePrincipal;
}

export interface DadosEnderecoMercurio {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  email: string;
  celularDdd: string;
  celularNumero: string;
  alternativoDdd: string;
  alternativoNumero: string;
}

export async function lerAbaEnderecos(frame: Frame): Promise<DadosEnderecoMercurio> {
  const valor = async (nome: string) => (await frame.locator(`[name="${nome}"]`).first().inputValue().catch(() => "")).trim();
  return {
    logradouro: await valor("txtlog"),
    bairro: await valor("txtbai"),
    cidade: await valor("txtcida"),
    uf: await valor("txtuf"),
    cep: await valor("txtcep"),
    email: await valor("txtemail"),
    celularDdd: await valor("txtddd"),
    celularNumero: await valor("txtfone"),
    alternativoDdd: await valor("txtcddd"),
    alternativoNumero: await valor("txtcel"),
  };
}

/**
 * Preenche e grava a aba ENDEREÇOS. Só altera os campos passados
 * (undefined = mantém o valor atual) — evita sobrescrever dado que o
 * Portal não coletou (ex: bairro, se o form do Portal não pedir).
 */
export async function escreverAbaEnderecos(frame: Frame, dados: Partial<DadosEnderecoMercurio>) {
  const preencherSe = async (nome: string, valor: string | undefined) => {
    if (valor === undefined) return;
    await frame.locator(`[name="${nome}"]`).first().fill(valor);
  };

  await preencherSe("txtlog", dados.logradouro);
  await preencherSe("txtbai", dados.bairro);
  await preencherSe("txtcida", dados.cidade);
  await preencherSe("txtuf", dados.uf);
  await preencherSe("txtcep", dados.cep);
  await preencherSe("txtemail", dados.email);
  await preencherSe("txtddd", dados.celularDdd);
  await preencherSe("txtfone", dados.celularNumero);
  await preencherSe("txtcddd", dados.alternativoDdd);
  await preencherSe("txtcel", dados.alternativoNumero);

  await frame.getByRole("button", { name: /gravar/i }).first().click();
  await frame.page().waitForTimeout(1500);
}
