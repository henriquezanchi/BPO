// Login no Mercúrio — 2 camadas, confirmadas ao vivo em 12/09/2026:
//   1. Autenticação HTTP básica do navegador (popup cinza nativo) — uma
//      credencial única compartilhada por todos os usuários da organização
//      (troca 1x por ano). Resolvida via `httpCredentials` no contexto do
//      Playwright — não precisa clicar em popup nenhum.
//   2. Tela de Matrícula + Senha (formulário simples, PHP puro, dentro de
//      um frame).
//
// Padrões de navegação (frames nomeados, espera ativa por URL) reaproveitados
// de um scraper já em produção para outra área do mesmo Mercúrio — testado
// e validado com Chromium comum (sem precisar de canal "chrome" real).

import { chromium } from 'playwright';

export const URL_LOGIN = 'https://mercurio.oinabn.com.br/';
export const URL_FUNCOES = 'https://mercurio.oinabn.com.br/ger_frame.php';

// Na Vercel (serverless) não existe o Chromium que o Playwright baixa —
// usa o build próprio pra Lambda do @sparticuz/chromium (mesma versão de
// Chromium do Playwright instalado: 153), sempre headless, sem modo
// gráfico (WebGL) — o servidor não precisa dele e economiza memória.
// /tmp na Vercel (10/10/2026): o diagnóstico mostrou memória sobrando
// (~3,9 de 4,3 GB livres) mas o /tmp (512 MB) sumindo a cada operação na
// mesma instância — 513 → 208 → 47 → 16 MB — até o Chromium quebrar
// ("browser has been closed") ou dar net::ERR_INSUFFICIENT_RESOURCES. Os
// perfis "playwright_*" eram apagados direito; o que sobrava eram outros
// arquivos que o Chromium (--single-process, sem /dev/shm) deixa no /tmp.
//
// Então: logo depois da 1ª extração do Chromium na instância, guarda a
// lista do que existe em /tmp (o próprio Chromium extraído, fontes etc. —
// isso fica). Ao fechar um navegador, se nenhum outro estiver aberto,
// apaga tudo do /tmp que não estava nessa lista.
let entradasBaseTmp = null;

// Módulos de sistema carregados só na Vercel (localmente nada disto roda).
let _os = null;
let _fs = null;
let _path = null;
async function carregarModulosFs() {
  if (!_fs) {
    _fs = await import('node:fs');
    _os = await import('node:os');
    _path = await import('node:path');
  }
}

function caminhoTmp() {
  return _os.tmpdir();
}

function tamanhoMb(caminho, profundidade = 0) {
  try {
    const st = _fs.lstatSync(caminho);
    if (!st.isDirectory()) return st.size;
    if (profundidade > 4) return 0;
    let total = 0;
    for (const n of _fs.readdirSync(caminho)) total += tamanhoMb(_path.join(caminho, n), profundidade + 1);
    return total;
  } catch {
    return 0;
  }
}

function diagnosticarTmp(momento) {
  try {
    const tmp = caminhoTmp();
    const disco = _fs.statfsSync(tmp);
    const mb = (n) => Math.round(n / 1024 / 1024);
    const maiores = _fs.readdirSync(tmp)
      .map((n) => ({ n, t: tamanhoMb(_path.join(tmp, n)) }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 5)
      .map((x) => `${x.n}=${mb(x.t)}MB`)
      .join(', ');
    console.log(`[navegador] ${momento} · memória livre ${mb(_os.freemem())}/${mb(_os.totalmem())} MB · /tmp livre ${mb(disco.bavail * disco.bsize)} MB · abertos: ${navegadoresAbertos} · maiores em /tmp: ${maiores}`);
  } catch (e) {
    console.log('[navegador] diagnóstico falhou:', e.message);
  }
}

function limparSobrasDoTmp() {
  if (!entradasBaseTmp) return;
  try {
    const tmp = caminhoTmp();
    let apagados = 0;
    for (const nome of _fs.readdirSync(tmp)) {
      if (entradasBaseTmp.has(nome)) continue;
      try {
        _fs.rmSync(_path.join(tmp, nome), { recursive: true, force: true });
        apagados++;
      } catch { /* em uso */ }
    }
    if (apagados) diagnosticarTmp(`limpeza (${apagados} item(ns) apagado(s))`);
  } catch { /* melhor esforço */ }
}

async function lancarChromium(headless) {
  if (!process.env.VERCEL) return chromium.launch({ headless });
  await carregarModulosFs();
  const { default: chromiumServerless } = await import('@sparticuz/chromium');
  chromiumServerless.setGraphicsMode = false;
  const executablePath = await chromiumServerless.executablePath();
  if (!entradasBaseTmp) entradasBaseTmp = new Set(_fs.readdirSync(caminhoTmp()));
  diagnosticarTmp('abrindo');
  return chromium.launch({
    executablePath,
    args: chromiumServerless.args,
    headless: true,
  });
}

// Limite de navegadores abertos AO MESMO TEMPO numa instância da Vercel.
// Histórico (10/10/2026): cada operação abria um Chromium inteiro e, com
// várias rodando juntas na mesma instância (ex: importação de rubricas em
// segundo plano + login), faltava recurso (net::ERR_INSUFFICIENT_RESOURCES).
// A 1ª tentativa de correção — um Chromium só, compartilhado entre
// operações — TRAVAVA: o build serverless roda com --single-process, e
// nesse modo vários contextos no mesmo navegador (e fechar um com outro
// aberto) penduram o navegador inteiro. Então: um navegador por operação
// (o modo que sempre funcionou), mas no máximo MAX_NAVEGADORES por
// instância — os demais esperam a vez em vez de esgotar a máquina.
const MAX_NAVEGADORES = 2;
let navegadoresAbertos = 0;
const filaNavegador = [];

function ocuparVaga() {
  if (navegadoresAbertos < MAX_NAVEGADORES) {
    navegadoresAbertos++;
    return Promise.resolve();
  }
  return new Promise((resolve) => filaNavegador.push(resolve));
}

function liberarVaga() {
  const proximo = filaNavegador.shift();
  if (proximo) proximo(); // a vaga passa direto pro próximo da fila
  else navegadoresAbertos--;
}

export async function abrirNavegador({ headless = false } = {}) {
  const limitar = Boolean(process.env.VERCEL);
  if (limitar) await ocuparVaga();
  let navegador;
  try {
    navegador = await lancarChromium(headless);
  } catch (e) {
    if (limitar) liberarVaga();
    throw e;
  }
  let context;
  let page;
  try {
    context = await navegador.newContext({
      httpCredentials: {
        username: process.env.MERCURIO_HTTP_USER,
        password: process.env.MERCURIO_HTTP_PASS,
      },
    });
    page = await context.newPage();
  } catch (e) {
    await navegador.close().catch(() => {});
    if (limitar) liberarVaga();
    throw e;
  }

  // O Mercúrio confirma várias ações com um confirm() nativo do navegador
  // (ex: "Finalizar esta Operação e Emitir o Recibo?", em Recebimento >
  // Contribuições/Doações, via onclick="return msg_desaba(...)") — SEM um
  // handler de 'dialog', o Playwright DESCARTA (cancela) esse popup
  // sozinho, silenciosamente: o clique em "Finalizar com/sem Recibo"
  // "funciona" (não dá erro na hora), mas o formulário nunca é enviado de
  // verdade, porque o próprio onclick retorna false quando o confirm() é
  // cancelado. Era exatamente por isso que o lançamento em si nunca
  // completava — achado direto de um print real do usuário mostrando esse
  // popup. Sempre aceitamos (equivalente a clicar "OK") porque, no momento
  // em que o código chega a clicar num botão desses, a decisão de
  // prosseguir já foi tomada (checagem de duplicata, conferência de valor
  // etc. já passaram antes) — não existe, hoje, nenhum ponto do código que
  // clique em algo que a gente QUEIRA cancelar (não mexemos em excluir/
  // cancelar recibo).
  page.on('dialog', (dialog) => {
    dialog.accept().catch(() => {});
  });

  // Quem chama sempre faz browser.close() no fim — aqui isso também libera
  // a vaga (uma vez só, mesmo se close() for chamado de novo).
  let fechado = false;
  const browser = {
    close: async () => {
      if (fechado) return;
      fechado = true;
      await navegador.close().catch(() => {});
      // Último navegador aberto da instância (e ninguém na fila): limpa as
      // sobras do /tmp antes de liberar a vaga.
      if (limitar && navegadoresAbertos === 1 && filaNavegador.length === 0) limparSobrasDoTmp();
      if (limitar) liberarVaga();
    },
  };
  return { browser, context, page };
}

// Quando isto é chamado, acharContextoComTexto() JÁ confirmou (com espera
// ativa própria, até 15s) que a página de login terminou de renderizar —
// não faz sentido esperar de novo aqui. Ou o campo tem um <label>
// acessível de verdade (getByLabel acha na hora) ou nunca vai ter (o
// Mercúrio é um form PHP simples, sem <label for> — bem provável que seja
// sempre este caso), e nenhuma espera adicional muda esse resultado.
// Antes esperava até 3s por CADA campo (matrícula + senha = ~6s de espera
// morta, praticamente garantida a esgotar o timeout inteiro toda vez) —
// corrigido depois do usuário notar a lentidão real no login. `fill()` já
// tem seu próprio timeout curto (1s) só como rede de segurança pra um
// último instante de renderização, sem voltar a esperar 3s por nada.
async function preencherComFallback(contexto, getByLabelRegex, seletorFallback, valor) {
  const campo = contexto.getByLabel(getByLabelRegex).first();
  try {
    if ((await campo.count()) === 0) throw new Error('sem rótulo acessível');
    await campo.fill(valor, { timeout: 1000 });
    return;
  } catch {
    await contexto.locator(seletorFallback).first().fill(valor);
  }
}

// Acha um contexto (page ou frame filho) que contenha o texto dado — usado
// só no login, antes de sabermos o nome de nenhum frame.
async function acharContextoComTexto(page, textoAlvo, timeoutMs = 15000) {
  const fim = Date.now() + timeoutMs;
  while (Date.now() < fim) {
    if (await page.getByText(textoAlvo, { exact: false }).count() > 0) return page;
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        if (await frame.getByText(textoAlvo, { exact: false }).count() > 0) return frame;
      } catch { /* frame pode ter sido destruído entre a checagem e o uso */ }
    }
    await page.waitForTimeout(120);
  }
  throw new Error(`Não encontrei "${textoAlvo}" na tela de login (timeout ${timeoutMs}ms). O layout do Mercúrio pode ter mudado.`);
}

export async function login(page, matricula, senha) {
  await page.goto(URL_LOGIN, { waitUntil: 'domcontentloaded' });

  const ctx = await acharContextoComTexto(page, 'Matr', 15000);
  const SELETOR_CAMPO_TEXTO = 'input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"])';
  await preencherComFallback(ctx, /matr[ií]cula/i, SELETOR_CAMPO_TEXTO, matricula);
  await preencherComFallback(ctx, /senha/i, 'input[type="password"]', senha);

  try {
    await ctx.getByRole('button', { name: /entrar/i }).click();
  } catch {
    await ctx.getByText('Entrar', { exact: false }).click();
  }

  await page.waitForURL(/ger_frame\.php/, { timeout: 20000 });
}

// Espera um frame FILHO com o `nome` dado existir e já ter navegado pra uma
// URL que bate com `regexUrl` — o Mercúrio usa nomes fixos de frame em
// todas as telas pós-login ("cabecalho", "principal", "indice").
export async function esperarFrame(page, nome, regexUrl, timeoutMs = 15000) {
  const fim = Date.now() + timeoutMs;
  while (Date.now() < fim) {
    const frame = page.frame({ name: nome });
    if (frame && regexUrl.test(frame.url())) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`Frame "${nome}" não chegou numa URL batendo com ${regexUrl} a tempo (timeout ${timeoutMs}ms).`);
}

// Lê, pra CADA link "TESOURARIA" da tela "Funções do Sistema", o título da
// filial correspondente (um <a class="menu_tit"> IRMÃO do link, não
// ancestral dele — mesmo cuidado que já corrigiu um bug real no scraper de
// CADASTRO). Devolve o Locator de cada link junto com o título lido, pra
// quem chamar poder tanto LISTAR (só os títulos) quanto CLICAR (usando o
// link já resolvido, sem precisar buscar de novo).
async function lerLinksTesourariaPorFilial(framePrincipal) {
  const links = framePrincipal.getByRole('link', { name: 'TESOURARIA', exact: true });
  const total = await links.count();
  const resultado = [];
  for (let i = 0; i < total; i++) {
    const link = links.nth(i);
    const titulo = await link.evaluate((el) => {
      const table = el.closest('table');
      if (!table) return '';
      const menuTit = table.querySelector('a.menu_tit');
      return (menuTit ? menuTit.textContent : table.rows[0]?.textContent || '').replace(/\s+/g, ' ').trim();
    });
    resultado.push({ titulo, link });
  }
  return resultado;
}

// Lista o NOME de toda filial em que este login tem acesso à Tesouraria —
// é justamente o link "TESOURARIA" que só aparece pras filiais liberadas
// pra essa matrícula (se o link não aparece, o usuário não tem acesso).
// Usado pra popular o seletor de filial na tela, em vez de exigir digitar
// o nome exato num .env.
export async function listarFiliaisComTesouraria(page) {
  await page.goto(URL_FUNCOES, { waitUntil: 'domcontentloaded' });
  const framePrincipal = await esperarFrame(page, 'principal', /ger_funcao\.php/, 15000);
  const itens = await lerLinksTesourariaPorFilial(framePrincipal);
  return itens.map((i) => i.titulo).filter(Boolean);
}

// Nome de quem está logado — a tela "Funções do Sistema" (ger_funcao.php,
// frame "principal") termina com uma linha "Funções do Sistema Autorizadas
// para 21596 - LUIZ HENRIQUE ZANCHI BORGES" (confirmado com print real e
// HTML do DevTools, 10/10/2026: <td colspan="2" bgcolor="SILVER">). Chamar
// logo depois de listarFiliaisComTesouraria(), que já deixa essa tela
// aberta. Melhor esforço: sem achar, null.
export async function lerNomeUsuarioNaTelaFuncoes(page) {
  try {
    const frame = page.frame({ name: 'principal' });
    if (!frame) return null;
    const texto = await frame.locator('body').innerText();
    const m = texto.match(/Autorizadas\s+para\s+\d+\s*-\s*([^\r\n]+)/i);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

// Clica no link TESOURARIA da filial certa, a partir da tela "Funções do
// Sistema" (ger_funcao.php dentro do frame "principal").
export async function abrirTesourariaDaFilial(page, nomeFilial) {
  await page.goto(URL_FUNCOES, { waitUntil: 'domcontentloaded' });
  const framePrincipal = await esperarFrame(page, 'principal', /ger_funcao\.php/, 15000);
  const itens = await lerLinksTesourariaPorFilial(framePrincipal);

  // Compara ignorando espaços ao redor de ":" (o Mercúrio às vezes mostra
  // "FILIAL: SUBFILIAL" sem espaço, às vezes com).
  const normAlvo = nomeFilial.replace(/\s*:\s*/g, ':').toUpperCase();
  for (const { titulo, link } of itens) {
    const normTitulo = titulo.replace(/\s*:\s*/g, ':').toUpperCase();
    if (normTitulo === normAlvo || normTitulo.includes(normAlvo)) {
      // Aproveita que está na tela de funções pra ler o nome de quem está
      // logado (linha "Funções do Sistema Autorizadas para ...").
      const nomeUsuario = await lerNomeUsuarioNaTelaFuncoes(page);
      await link.click();
      await page.waitForURL(/tesoura\/tes_frame\.php/, { timeout: 15000 });
      return { nomeUsuario };
    }
  }
  throw new Error(`Link "TESOURARIA" da filial "${nomeFilial}" não encontrado. Confira o nome exato (ou use "Listar filiais" na tela pra escolher de uma lista, em vez de digitar).`);
}
