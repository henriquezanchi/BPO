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

/**
 * Lista os links de um módulo (ex: "CADASTRO", "TESOURARIA") no menu de
 * topo (ger_funcao.php) — cada filial tem sua própria instância desses
 * links, identificada pelo texto da tabela de menu ancestral (nome da
 * filial), não por um id estável.
 */
async function listarLinksMenu(page: Page, nomeFuncao: string) {
  const framePrincipal = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
  const links = framePrincipal.getByRole("link", { name: nomeFuncao, exact: true });
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
 * Navega até a lista de Ativos de uma filial (dentro de "PROGRAMA BRANCO"
 * — a mesma navegação usada em toda leitura/escrita de contato). O
 * Mercúrio não permite navegação direta por URL com matrícula (URL fixa
 * exige ter entrado pela filial certa primeiro, confirmado ao vivo: "File
 * not found" ao tentar direto).
 */
export async function abrirListaAtivos(page: Page, filialLabelRegex: RegExp): Promise<Frame> {
  const cadastros = await listarLinksMenu(page, "CADASTRO");
  const filial = cadastros.find((c) => filialLabelRegex.test(c.label));
  if (!filial) {
    throw new Error(`Filial batendo com ${filialLabelRegex} não encontrada entre: ${cadastros.map((c) => c.label).join(", ")}`);
  }

  const framePrincipal0 = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
  await framePrincipal0.getByRole("link", { name: "CADASTRO", exact: true }).nth(filial.indice).click();

  const frameIndice = await esperarFrame(page, "indice", /uni_indice\.php/, 15000);
  await frameIndice.getByText("Ativos", { exact: true }).click();
  return esperarFrame(page, "principal", /uni_newati\.php/, 15000);
}

/**
 * Entra no módulo TESOURARIA de uma filial (menu de topo) e devolve o
 * frame de conteúdo ("principal") — a essa altura ele mostra uma página
 * padrão qualquer (ex: tes_contato.html), útil como ponto de partida pra
 * navegar (via frame.goto) direto pra qualquer tela de dentro da
 * Tesouraria sem precisar clicar em cada submenu.
 */
async function abrirTesouraria(page: Page, filialLabelRegex: RegExp): Promise<Frame> {
  const tesourarias = await listarLinksMenu(page, "TESOURARIA");
  const filial = tesourarias.find((t) => filialLabelRegex.test(t.label));
  if (!filial) {
    throw new Error(`Filial batendo com ${filialLabelRegex} sem link de TESOURARIA entre: ${tesourarias.map((t) => t.label).join(", ")}`);
  }

  const framePrincipal0 = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
  await framePrincipal0.getByRole("link", { name: "TESOURARIA", exact: true }).nth(filial.indice).click();
  return esperarFrame(page, "principal", /tesoura\//, 15000);
}

/**
 * Abre a tela "Recibos Emitidos" (tesoura/tes_cailstr.php) da Tesouraria de
 * uma filial — listagem mensal (por padrão o mês corrente). Visitar essa
 * tela é o que "destrava" a sessão pra emitir o documento do recibo depois
 * (tes_conprt.php recusa direto com "Configure a impressora..." se a
 * sessão nunca passou por aqui — confirmado ao vivo). `ano`/`mes`
 * (opcionais) navegam pra um mês específico via os mesmos parâmetros que o
 * seletor de mês da própria tela usa (pa=ano&pm=mes).
 */
export async function abrirTelaRecibos(page: Page, filialLabelRegex: RegExp, ano?: number, mes?: number): Promise<Frame> {
  await abrirTesouraria(page, filialLabelRegex);

  const frameIndice = await esperarFrame(page, "indice", /tes_indice\.php/, 15000);
  await frameIndice.getByRole("link", { name: "Recibos", exact: true }).click();

  const frame = await esperarFrame(page, "principal", /tes_cailstr\.php/, 15000);
  if (ano !== undefined && mes !== undefined) {
    await frame.goto(`https://mercurio.oinabn.com.br/tesoura/tes_cailstr.php?pa=${ano}&pm=${mes}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
  }
  return frame;
}

export interface FichaAnualMes {
  mes: number; // 1-12
  status: "paga" | "em_branco" | "atrasado" | "isento";
  registradoEmBR: string | null; // "dd/mm/yyyy", null se nunca registrado
  responsavel: string | null;
  mercurioRecId: string | null; // liga com ContributionReceipt, se já sincronizado
}

function statusFichaAnualDeTexto(texto: string): FichaAnualMes["status"] {
  const t = texto.trim().toUpperCase();
  if (t.startsWith("PAGA")) return "paga";
  if (t.startsWith("ATRAS")) return "atrasado";
  if (t.startsWith("ISENT")) return "isento";
  return "em_branco";
}

/**
 * Abre a "Ficha Anual" (tesoura/tes_condeta.php) de um aluno — mostra a
 * composição (redundante com abrirComposicao, útil só pra cross-check) e,
 * mais importante, o status mês a mês (PAGA/EM BRANCO/EM ATRASO/ISENTO)
 * do ano informado. Diferente da Composição/Recibos, é navegável direto
 * pela matrícula (sem precisar casar por nome).
 */
export async function abrirFichaAnual(page: Page, filialLabelRegex: RegExp, matricula: string, ano: number): Promise<Frame> {
  const frame = await abrirTesouraria(page, filialLabelRegex);
  await frame.goto(`https://mercurio.oinabn.com.br/tesoura/tes_condeta.php?matr=${matricula}&ano=${ano}&cmb=ATI`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(600);
  return frame;
}

/** Lê a grade mês a mês da Ficha Anual já aberta (ver abrirFichaAnual). */
export async function lerFichaAnual(frame: Frame): Promise<FichaAnualMes[]> {
  const linhas: { mes: string; status: string; registro: string; responsavel: string; mercurioRecId: string | null }[] =
    await frame.evaluate(() => {
      const tabelas = Array.from(document.querySelectorAll("table"));
      // Tabelas aninhadas: a mais externa contém tudo, então checar só se
      // "Mês" aparece em algum lugar da 1ª linha (t.rows[0].innerText)
      // bate com ela também (falso-positivo) — precisa ser exatamente a
      // 1ª CÉLULA da 1ª linha pra achar a tabela certa (a de verdade, não
      // a que só a envolve).
      const tabela = tabelas.find((t) => /^m[eê]s$/i.test((t.rows[0]?.cells[0]?.innerText ?? "").trim()));
      if (!tabela) return [];
      return Array.from(tabela.rows)
        .slice(1)
        .map((linha) => {
          const celulas = Array.from(linha.cells).map((c) => (c as HTMLElement).innerText.trim());
          const linkRecibo = linha.querySelector('a[onclick*="tes_conprt"]');
          const onclick = linkRecibo?.getAttribute("onclick") ?? "";
          const recMatch = onclick.match(/rec=(\d+)/);
          return {
            mes: celulas[0] ?? "",
            status: celulas[1] ?? "",
            registro: celulas[celulas.length - 2] ?? "",
            responsavel: celulas[celulas.length - 1] ?? "",
            mercurioRecId: recMatch?.[1] ?? null,
          };
        });
    });

  return linhas
    .map((l) => ({
      mes: parseInt(l.mes, 10),
      status: statusFichaAnualDeTexto(l.status),
      registradoEmBR: l.registro && l.registro !== "00/00/0000" ? l.registro : null,
      responsavel: l.responsavel && l.responsavel !== "-" ? l.responsavel : null,
      mercurioRecId: l.mercurioRecId,
    }))
    .filter((m) => Number.isInteger(m.mes) && m.mes >= 1 && m.mes <= 12);
}

export interface ReciboMercurio {
  mercurioRecId: string;
  dateBR: string; // "dd/mm/yyyy"
  interessado: string;
  amount: number;
  /**
   * Heurística: a linha só oferece o link "Cancela" enquanto o recibo
   * ainda está ativo — sua ausência sugere já cancelado/superado, mas não
   * é garantido (a tela usa cor pra marcar status, perdida no texto). Não
   * usar como fonte definitiva de "cancelado" — só pra pré-triagem; a
   * confirmação de verdade vem do conteúdo do próprio documento (ver
   * lerConteudoRecibo, que procura "CANCELADO" no texto).
   */
  provavelmenteCancelado: boolean;
}

/** Lê as linhas da listagem de Recibos Emitidos de um mês já aberto (ver abrirTelaRecibos). */
export async function lerRecibosDoMes(frame: Frame): Promise<ReciboMercurio[]> {
  const linhas = frame.locator('tr:has(a:has-text("Recibo"))');
  const total = await linhas.count();
  const resultado: ReciboMercurio[] = [];
  for (let i = 0; i < total; i++) {
    const linha = linhas.nth(i);
    const celulas = linha.locator("td");
    if ((await celulas.count()) < 5) continue;
    const numTexto = (await celulas.nth(0).innerText()).trim();
    const dateBR = (await celulas.nth(1).innerText()).trim();
    const interessado = (await celulas.nth(2).innerText()).trim();
    const amountTexto = (await celulas.nth(4).innerText()).trim();
    const temCancela = (await linha.locator('a:has-text("Cancela")').count()) > 0;
    const mercurioRecId = numTexto.replace(/^0+/, "");
    if (!mercurioRecId || !dateBR) continue;
    resultado.push({ mercurioRecId, dateBR, interessado, amount: parseValorFlexivel(amountTexto), provavelmenteCancelado: !temCancela });
  }
  return resultado;
}

export interface ConteudoRecibo {
  rawText: string;
  canceled: boolean;
}

/**
 * Busca o documento de um recibo específico (tesoura/tes_conprt.php) — só
 * funciona depois de ter passado pela tela de Recibos da filial certa na
 * MESMA sessão (ver abrirTelaRecibos). Texto pré-formatado (monoespaçado),
 * é o próprio comprovante — "CANCELADO" aparece literalmente no texto
 * quando o recibo foi cancelado depois de emitido.
 */
export async function lerConteudoRecibo(page: Page, mercurioRecId: string): Promise<ConteudoRecibo> {
  await page.goto(`https://mercurio.oinabn.com.br/tesoura/tes_conprt.php?rec=${mercurioRecId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const rawText = (await page.locator("pre").innerText()).trim();
  // O template imprime "C A N C E L A D O" com espaço entre cada letra
  // (confirmado ao vivo) — sem remover espaços antes, um regex simples
  // "CANCELADO" nunca bate e o cancelamento passa batido.
  const semEspacos = rawText.replace(/\s+/g, "").toUpperCase();
  return { rawText, canceled: semEspacos.includes("CANCELADO") };
}

/**
 * Extrai um rótulo curto pro recibo a partir do texto ("CONTRIBUIÇÃO
 * BIBLIOTECA", ou "CONTRIBUIÇÃO BIBLIOTECA +5 itens" se tiver mais de
 * uma rubrica) — cada linha de item é "Qt Descrição.......Valor" (2+
 * espaços entre descrição e valor); a linha seguinte, com o nome do
 * membro, não bate nesse padrão e é ignorada. Descrições longas
 * quebram em 2 linhas no template ("...PARA O BEM ME" + "NSAL" na
 * linha de baixo) — a versão truncada é aceitável pra um rótulo
 * "simplificado".
 */
export function extrairRubricaSimplificada(rawText: string): string {
  const nomes = rawText
    .split("\n")
    .map((linha) => linha.match(/^\s*\d+\s+(.+?)\s{2,}[\d.]+\.\d{2}\s*$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[1].trim());

  if (nomes.length === 0) return "Comprovante";
  if (nomes.length === 1) return nomes[0];
  return `${nomes[0]} +${nomes.length - 1} ${nomes.length - 1 === 1 ? "item" : "itens"}`;
}

/**
 * Lê a coluna "Nome" da tabela de Ativos (achando a posição certa pelo
 * cabeçalho, não por índice fixo) e devolve o texto de cada link — usado
 * pra escolher um aluno real pra teste sem precisar saber o nome de
 * antemão (ver scripts/onboard-filial.ts).
 */
export async function listarNomesDaListaAtivos(frame: Frame, limite = 10): Promise<string[]> {
  const cabecalhos = await frame.locator("table").first().locator("tr").first().locator("td, th").allInnerTexts();
  const colNome = cabecalhos.findIndex((c) => /^nome$/i.test(c.trim()));
  if (colNome === -1) throw new Error(`Coluna "Nome" não encontrada no cabeçalho: ${cabecalhos.join(" | ")}`);

  const linhas = frame.locator("table").first().locator("tr");
  const total = Math.min(await linhas.count(), limite + 1); // +1 pela linha de cabeçalho
  const nomes: string[] = [];
  for (let i = 1; i < total; i++) {
    const texto = (await linhas.nth(i).locator("td").nth(colNome).innerText()).trim();
    if (texto) nomes.push(texto);
  }
  return nomes;
}

/**
 * Lê a coluna "Matr" (matrícula real, confirmado ao vivo — diferente da
 * tabela de Turma que o scraper original usa, aqui "Matr" NÃO é índice de
 * linha) de TODA a lista de Ativos — usado pra sincronizar em massa quem
 * está ativo numa filial numa sessão só (scripts/sync-active-status.ts),
 * em vez de checar 1 aluno por vez.
 */
export async function listarMatriculasAtivas(frame: Frame): Promise<string[]> {
  const cabecalhos = await frame.locator("table").first().locator("tr").first().locator("td, th").allInnerTexts();
  const colMatr = cabecalhos.findIndex((c) => /^matr\.?$/i.test(c.trim()));
  if (colMatr === -1) throw new Error(`Coluna "Matr" não encontrada no cabeçalho: ${cabecalhos.join(" | ")}`);

  const linhas = frame.locator("table").first().locator("tr");
  const total = await linhas.count();
  const matriculas: string[] = [];
  for (let i = 1; i < total; i++) {
    const texto = (await linhas.nth(i).locator("td").nth(colMatr).innerText()).trim();
    if (texto) matriculas.push(texto);
  }
  return matriculas;
}

/**
 * A partir da lista de Ativos JÁ ABERTA (ver abrirListaAtivos), clica no
 * aluno que bate com `nomeRegex` e abre a aba ENDEREÇOS da ficha dele.
 */
export async function abrirFichaDaListaAtivos(page: Page, frameAtivos: Frame, nomeRegex: RegExp): Promise<Frame> {
  const linkNome = frameAtivos.getByRole("link", { name: nomeRegex }).first();
  await linkNome.waitFor({ timeout: 10000 });
  await linkNome.click();

  const framePrincipal = await esperarFrame(page, "principal", /uni_cadfun\.php/, 15000);
  await page.waitForTimeout(800);
  await framePrincipal.getByText(/^ENDERE[ÇC]OS$/i).first().click();
  await page.waitForTimeout(800);
  return framePrincipal;
}

export interface DadosEnderecoMercurio {
  matricula: string;
  nomeCompleto: string;
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
    matricula: await valor("matr"),
    nomeCompleto: await valor("txtnome"),
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

// ===================== Aba PESSOAIS =====================
// Campos confirmados ao vivo (2026-09-14): txtnatu (naturalidade), txtnaci
// (nacionalidade — não exposta na Portal por ora), txtdia/txtmes/txtano
// (nascimento), cmbsexo, cmbcivi (código — ver personal-data-options.ts),
// cmbesco (código, idem), txtprof (profissão).

export interface DadosPessoaisMercurio {
  naturalidade: string;
  nascimentoDia: string;
  nascimentoMes: string;
  nascimentoAno: string;
  estadoCivil: string; // código (SOL, CAS...)
  escolaridade: string; // código (GR1, GRP...)
  profissao: string;
}

async function abrirAbaPessoais(frame: Frame): Promise<void> {
  await frame.getByText(/^PESSOAIS$/i).first().click();
  await frame.page().waitForTimeout(800);
}

export async function lerAbaPessoais(frame: Frame): Promise<DadosPessoaisMercurio> {
  await abrirAbaPessoais(frame);
  const valor = async (nome: string) => (await frame.locator(`[name="${nome}"]`).first().inputValue().catch(() => "")).trim();
  return {
    naturalidade: await valor("txtnatu"),
    nascimentoDia: await valor("txtdia"),
    nascimentoMes: await valor("txtmes"),
    nascimentoAno: await valor("txtano"),
    estadoCivil: await valor("cmbcivi"),
    escolaridade: await valor("cmbesco"),
    profissao: await valor("txtprof"),
  };
}

export async function escreverAbaPessoais(frame: Frame, dados: Partial<DadosPessoaisMercurio>) {
  await abrirAbaPessoais(frame);
  const preencherSe = async (nome: string, valor: string | undefined) => {
    if (valor === undefined) return;
    await frame.locator(`[name="${nome}"]`).first().fill(valor);
  };
  const selecionarSe = async (nome: string, valor: string | undefined) => {
    if (valor === undefined) return;
    await frame.locator(`[name="${nome}"]`).first().selectOption(valor);
  };

  await preencherSe("txtnatu", dados.naturalidade);
  await preencherSe("txtdia", dados.nascimentoDia);
  await preencherSe("txtmes", dados.nascimentoMes);
  await preencherSe("txtano", dados.nascimentoAno);
  await selecionarSe("cmbcivi", dados.estadoCivil);
  await selecionarSe("cmbesco", dados.escolaridade);
  await preencherSe("txtprof", dados.profissao);

  await frame.getByRole("button", { name: /gravar/i }).first().click();
  await frame.page().waitForTimeout(1500);
}

// ===================== Aba IDENTIFICAÇÃO =====================
// Campos confirmados ao vivo: txtrg (número), txtexped (órgão expedidor),
// txtdia/txtmes/txtano (emissão — "00/00/0000" quando não preenchido, não
// é uma data válida), txtcpf. CPF só é lido pra derivar a senha inicial de
// login (scripts/provision-member-auth.ts) — não é persistido no Member
// (minimização de dado sensível: não precisamos guardar o CPF inteiro).
// Passaporte existe na mesma aba mas não é usado.

export interface DadosIdentificacaoMercurio {
  cpf: string;
  rgNumero: string;
  rgOrgaoEmissor: string;
  rgEmissaoDia: string;
  rgEmissaoMes: string;
  rgEmissaoAno: string;
}

async function abrirAbaIdentificacao(frame: Frame): Promise<void> {
  await frame.getByText(/^IDENTIFICA[ÇC][ÃA]O$/i).first().click();
  await frame.page().waitForTimeout(800);
}

export async function lerAbaIdentificacao(frame: Frame): Promise<DadosIdentificacaoMercurio> {
  await abrirAbaIdentificacao(frame);
  const valor = async (nome: string) => (await frame.locator(`[name="${nome}"]`).first().inputValue().catch(() => "")).trim();
  return {
    cpf: await valor("txtcpf"),
    rgNumero: await valor("txtrg"),
    rgOrgaoEmissor: await valor("txtexped"),
    rgEmissaoDia: await valor("txtdia"),
    rgEmissaoMes: await valor("txtmes"),
    rgEmissaoAno: await valor("txtano"),
  };
}

export async function escreverAbaIdentificacao(frame: Frame, dados: Partial<DadosIdentificacaoMercurio>) {
  await abrirAbaIdentificacao(frame);
  const preencherSe = async (nome: string, valor: string | undefined) => {
    if (valor === undefined) return;
    await frame.locator(`[name="${nome}"]`).first().fill(valor);
  };

  await preencherSe("txtrg", dados.rgNumero);
  await preencherSe("txtexped", dados.rgOrgaoEmissor);
  await preencherSe("txtdia", dados.rgEmissaoDia);
  await preencherSe("txtmes", dados.rgEmissaoMes);
  await preencherSe("txtano", dados.rgEmissaoAno);

  await frame.getByRole("button", { name: /gravar/i }).first().click();
  await frame.page().waitForTimeout(1500);
}

// ===================== Composição das Contribuições =====================
// Módulo diferente (Tesouraria/Economia, não a ficha uni_cadfun.php) —
// confirmado ao vivo (2026-09-15) que dá pra navegar direto por matrícula
// depois de já estar dentro da ficha do aluno (mesmo frame "principal").
//   tesoura/tes_conedit.php?matr=X&cmb=ATI        = lista + incluir (cmbgrp)
//   tesoura/tes_conedit1.php?matr=X&grp=Y&cmb=ATI = editar valor (txtval)
//   tesoura/tes_conedit.php?matr=X&cmdExcluir=Y   = excluir (GET simples)
// O "grp" de um item recém-incluído é o MESMO valor do catálogo (cmbgrp)
// selecionado — confirmado ao vivo incluindo e excluindo "DIÁRIAS EVENTO
// NACIONAL" (cmbgrp=2308) na composição real do Luiz.

export interface ItemComposicaoMercurio {
  mercurioGroupId: string;
  label: string;
  amount: number;
}

export interface CatalogoItemMercurio {
  value: string;
  label: string;
}

/**
 * A tabela de Composição usa PONTO decimal ("100.00" — confirmado ao vivo,
 * 2026-09-15), diferente da tela de Editar valor (tes_conedit1.php), que
 * usa vírgula ("100,00", formato brasileiro). Em vez de assumir um
 * formato fixo (bug real: assumir vírgula aqui inflava tudo por 100x, já
 * que o "." de "100.00" era tratado como separador de milhar), decide
 * pelo separador mais à direita — esse é sempre o decimal, nos dois
 * formatos, com ou sem separador de milhar.
 */
function parseValorFlexivel(texto: string): number {
  const limpo = texto.trim();
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let normalizado: string;
  if (ultimaVirgula > ultimoPonto) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > ultimaVirgula) {
    normalizado = limpo.replace(/,/g, "");
  } else {
    normalizado = limpo;
  }
  const n = parseFloat(normalizado);
  return Number.isNaN(n) ? 0 : n;
}

/** A partir da ficha já aberta (qualquer aba), navega pra Composição das Contribuições daquele aluno. */
export async function abrirComposicao(page: Page, frameFicha: Frame, matricula: string): Promise<Frame> {
  await frameFicha.goto(`https://mercurio.oinabn.com.br/tesoura/tes_conedit.php?matr=${matricula}&cmb=ATI`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  return frameFicha;
}

export async function lerComposicao(frame: Frame): Promise<ItemComposicaoMercurio[]> {
  const linhas = frame.locator('tr:has(a:has-text("Excluir"))');
  const total = await linhas.count();
  const itens: ItemComposicaoMercurio[] = [];
  for (let i = 0; i < total; i++) {
    const linha = linhas.nth(i);
    const celulas = linha.locator("td");
    const label = (await celulas.nth(0).innerText()).trim();
    const valorTexto = (await celulas.nth(1).innerText()).trim();
    const excluirHref = await linha.locator('a:has-text("Excluir")').getAttribute("href");
    const grpMatch = excluirHref?.match(/cmdExcluir=(\d+)/);
    if (!grpMatch) continue;
    itens.push({ mercurioGroupId: grpMatch[1], label, amount: parseValorFlexivel(valorTexto) });
  }
  return itens;
}

/** Opções do <select> "Itens de Contribuição" — só os tipos que o aluno AINDA NÃO tem. */
export async function lerCatalogoItensDisponiveis(frame: Frame): Promise<CatalogoItemMercurio[]> {
  return frame.locator('select[name="cmbgrp"] option').evaluateAll((els) =>
    els.map((el) => ({ value: (el as HTMLOptionElement).value, label: (el.textContent ?? "").trim() })),
  );
}

/** Inclui um item pelo código do catálogo (value do <select> cmbgrp) — o Mercúrio aplica o valor padrão dele automaticamente. */
export async function incluirItemComposicao(frame: Frame, mercurioGroupId: string): Promise<void> {
  await frame.locator('select[name="cmbgrp"]').selectOption(mercurioGroupId);
  await frame.getByRole("button", { name: /incluir/i }).click();
  await frame.page().waitForTimeout(1000);
}

export async function excluirItemComposicao(frame: Frame, matricula: string, mercurioGroupId: string): Promise<void> {
  await frame.goto(`https://mercurio.oinabn.com.br/tesoura/tes_conedit.php?matr=${matricula}&cmdExcluir=${mercurioGroupId}`, {
    waitUntil: "domcontentloaded",
  });
  await frame.page().waitForTimeout(800);
}

/** `novoValor` no formato brasileiro, ex: "50,00". */
export async function editarValorItemComposicao(frame: Frame, matricula: string, mercurioGroupId: string, novoValor: string): Promise<void> {
  await frame.goto(`https://mercurio.oinabn.com.br/tesoura/tes_conedit1.php?matr=${matricula}&grp=${mercurioGroupId}&cmb=ATI`, {
    waitUntil: "domcontentloaded",
  });
  await frame.page().waitForTimeout(500);
  await frame.locator('input[name="txtval"]').fill(novoValor);
  await frame.getByRole("button", { name: /gravar/i }).click();
  await frame.page().waitForTimeout(1000);
}

// ===================== Integração > Pedagogos =====================
// Módulo diferente de novo (não Cadastro/Tesouraria) — confirmado ao vivo
// (2026-09-15): clicar em "INTEGRAÇÃO" no menu de topo troca a página
// inteira (não só o frame "principal" de ger_frame.php) pra um novo
// frameset em integra/int_frame.php, com um frame "indice"
// (integra/int_indice.php, o submenu à esquerda) e um frame "principal"
// (começa em unidade/uni_contato.html, igual TESOURARIA). O link
// "Pedagogos" dentro do frame "indice" navega o "principal" pra
// integra/int_pedlis.php — uma tabela simples (Matr./Nome/Formação/Grau
// Acadêmico) com todo pedagogo (INSTRUTOR ou EM FORMAÇÃO) daquela filial.

/** Entra no módulo INTEGRAÇÃO de uma filial e devolve o frame "indice" (submenu à esquerda). */
async function abrirIntegracao(page: Page, filialLabelRegex: RegExp): Promise<Frame> {
  const integracoes = await listarLinksMenu(page, "INTEGRAÇÃO");
  const filial = integracoes.find((i) => filialLabelRegex.test(i.label));
  if (!filial) {
    throw new Error(`Filial batendo com ${filialLabelRegex} sem link de INTEGRAÇÃO entre: ${integracoes.map((i) => i.label).join(", ")}`);
  }

  const framePrincipal0 = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
  await framePrincipal0.getByRole("link", { name: "INTEGRAÇÃO", exact: true }).nth(filial.indice).click();
  return esperarFrame(page, "indice", /int_indice\.php/, 15000);
}

export interface PedagogoMercurio {
  matricula: string;
  nome: string;
  formacao: string; // texto livre do Mercúrio, ex: "INSTRUTOR", "EM FORMAÇÃO"
}

/** Abre "Integração > Pedagogos" de uma filial e devolve o frame "principal" com a listagem. */
export async function abrirListaPedagogos(page: Page, filialLabelRegex: RegExp): Promise<Frame> {
  const frameIndice = await abrirIntegracao(page, filialLabelRegex);
  await frameIndice.getByRole("link", { name: "Pedagogos", exact: true }).click();
  return esperarFrame(page, "principal", /int_pedlis\.php/, 15000);
}

/** Lê a listagem de Pedagogos já aberta (ver abrirListaPedagogos). */
export async function lerListaPedagogos(frame: Frame): Promise<PedagogoMercurio[]> {
  return frame.evaluate(() => {
    const tabela = document.querySelector("table");
    if (!tabela) return [];
    return Array.from(tabela.querySelectorAll("tr"))
      .filter((tr) => tr.querySelector("td"))
      .map((tr) => {
        const celulas = Array.from(tr.querySelectorAll("td")).map((td) => (td as HTMLElement).innerText.trim());
        return { matricula: celulas[0] ?? "", nome: celulas[1] ?? "", formacao: celulas[2] ?? "" };
      })
      .filter((p) => p.matricula);
  });
}

// ===================== Turmas e Escala de Professores =====================
// Módulo CADASTRO de novo (não Integração) — dentro do frame "indice" de
// uma filial (uni_indice.php, o mesmo usado por abrirListaAtivos) tem um
// link "Turmas" (aparece 2x no menu — "PROGRAMA BRANCO" e "COMPLEMENTAR" —
// o 1º já é o que precisamos, confirmado batendo com o scraper irmão desse
// projeto — scraper/mercurio.js, repo crm-agencia-na, função
// processarTurmas — que usa exatamente esse mesmo caminho pra achar a
// ficha de cada turma). Leva a uni_esctur.php: lista de turmas da filial
// com 3 botões (Nova Turma/Listar Turmas/Escala de Professores) — o último
// abre uni_escesc.php, uma tabela só (Professor/Turma/Nível/Matéria/
// Início/Dia/Horário/Sala) SEM matrícula — cruzar com o Member local só dá
// por nome (confirmado via print do usuário, 2026-09-17).

async function abrirTurmas(page: Page, filialLabelRegex: RegExp): Promise<Frame> {
  const cadastros = await listarLinksMenu(page, "CADASTRO");
  const filial = cadastros.find((c) => filialLabelRegex.test(c.label));
  if (!filial) {
    throw new Error(`Filial batendo com ${filialLabelRegex} sem link de CADASTRO entre: ${cadastros.map((c) => c.label).join(", ")}`);
  }

  const framePrincipal0 = await esperarFrame(page, "principal", /ger_funcao\.php/, 15000);
  await framePrincipal0.getByRole("link", { name: "CADASTRO", exact: true }).nth(filial.indice).click();

  const frameIndice = await esperarFrame(page, "indice", /uni_indice\.php/, 15000);
  await frameIndice.getByText("Turmas", { exact: true }).first().click();
  return esperarFrame(page, "principal", /uni_esctur\.php/, 15000);
}

export interface EscalaProfessorMercurio {
  professor: string;
  turma: string;
  nivel: string;
  materia: string;
  inicio: string; // "dd/mm/yyyy"
  dia: string;
  horario: string;
  sala: string;
}

/** Abre "Turmas > Escala de Professores" de uma filial. */
export async function abrirEscalaProfessores(page: Page, filialLabelRegex: RegExp): Promise<Frame> {
  const frameTurmas = await abrirTurmas(page, filialLabelRegex);
  await frameTurmas.getByRole("link", { name: "Escala de Professores", exact: true }).click();
  return esperarFrame(page, "principal", /uni_escesc\.php/, 15000);
}

/** Lê a Escala de Professores já aberta (ver abrirEscalaProfessores). */
export async function lerEscalaProfessores(frame: Frame): Promise<EscalaProfessorMercurio[]> {
  return frame.evaluate(() => {
    const tabela = document.querySelector("table");
    if (!tabela) return [];
    return Array.from(tabela.rows)
      .slice(1)
      .map((linha) => {
        const c = Array.from(linha.cells).map((td) => (td as HTMLElement).innerText.trim());
        return { professor: c[0] ?? "", turma: c[1] ?? "", nivel: c[2] ?? "", materia: c[3] ?? "", inicio: c[4] ?? "", dia: c[5] ?? "", horario: c[6] ?? "", sala: c[7] ?? "" };
      })
      .filter((e) => e.professor);
  });
}

export interface AlunoTurmaMercurio {
  nome: string;
  ingressoEmBR: string | null; // "dd/mm/yyyy", null se não veio preenchido
}

/**
 * A partir da lista de turmas já aberta (ver abrirTurmas — hoje só exposto
 * indiretamente, então esta função reabre do zero), entra na ficha de 1
 * turma e lê o roster de alunos (tabela com colunas "Nome"/"Ingresso" —
 * mesmo critério de detecção do scraper irmão, mas checando a célula exata
 * do cabeçalho em vez de substring da linha inteira, pra não cair na
 * mesma pegadinha de tabela aninhada já vista em lerFichaAnual).
 */
export async function abrirDetalheTurma(page: Page, filialLabelRegex: RegExp, nomeTurma: string): Promise<Frame> {
  const frameTurmas = await abrirTurmas(page, filialLabelRegex);
  await frameTurmas.getByRole("link", { name: nomeTurma, exact: true }).click();
  return esperarFrame(page, "principal", /uni_esctal\.php/, 15000);
}

export async function lerAlunosDaTurma(frame: Frame): Promise<AlunoTurmaMercurio[]> {
  return frame.evaluate(() => {
    const tabelas = Array.from(document.querySelectorAll("table"));
    for (const tabela of tabelas) {
      const cabecalhos = Array.from(tabela.rows[0]?.cells ?? []).map((c) => (c as HTMLElement).innerText.trim().toLowerCase());
      const colNome = cabecalhos.findIndex((c) => c === "nome");
      const colIngresso = cabecalhos.findIndex((c) => c === "ingresso");
      if (colNome === -1 || colIngresso === -1) continue;
      return Array.from(tabela.rows)
        .slice(1)
        .map((linha) => {
          const celulas = Array.from(linha.cells).map((c) => (c as HTMLElement).innerText.trim());
          return { nome: celulas[colNome] ?? "", ingressoEmBR: celulas[colIngresso] || null };
        })
        .filter((a) => a.nome);
    }
    return [];
  });
}
