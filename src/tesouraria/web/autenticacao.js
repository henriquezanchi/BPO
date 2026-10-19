// Porta de entrada do site online (Vercel) — com a PRÓPRIA matrícula e
// senha do Mercúrio. Pedido do usuário: só entra quem tem o módulo
// Tesouraria liberado no Mercúrio; quem não tem recebe uma mensagem dizendo
// isso. Sem essa porta, qualquer pessoa com a URL usaria a credencial
// universal do Mercúrio e veria as regras (nomes/matrículas de alunos).
//
// Como funciona: POST /api/entrar loga no Mercúrio de verdade (mesmo
// navegador invisível do resto do app) e lê as filiais com o link
// "TESOURARIA". Login recusado ou nenhuma filial → acesso negado, com a
// mensagem certa. Com acesso → cookie de sessão assinado (HMAC com
// SEGREDO_SESSAO) guardando só a matrícula e a validade.
//
// A senha do Mercúrio NUNCA fica no servidor (mesma regra de sempre do
// projeto): a tela de entrar guarda matrícula/senha no sessionStorage da
// própria aba, e a tela principal as envia a cada operação, como antes.
//
// Rodando localmente (pasta portátil) sem SEGREDO_SESSAO, não pede nada —
// mesmo comportamento de antes. Na Vercel, sem SEGREDO_SESSAO, o site
// recusa tudo (nunca fica aberto por esquecimento).

import crypto from 'node:crypto';
import { lerValor, gravarValor } from '../lib/armazenamento.js';
import { validarEnv } from '../lib/configuracao.js';

const COOKIE = 'tesouraria_sessao';
const VALIDADE_S = 12 * 60 * 60;
// Tentativas de login erradas por IP — cada tentativa abre o Mercúrio de
// verdade, então limita tentativa e erro em massa através do site.
const MAX_FALHAS = 8;
const JANELA_FALHAS_MS = 15 * 60 * 1000;

function segredo() {
  return process.env.SEGREDO_SESSAO || '';
}

export function autenticacaoAtiva() {
  return Boolean(segredo()) || Boolean(process.env.VERCEL);
}

function assinar(texto) {
  return crypto.createHmac('sha256', segredo()).update(texto).digest('base64url');
}

function iguais(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function lerCookie(req, nome) {
  for (const parte of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

// O nome vai junto (assinado) só pra tela mostrar em qualquer aba.
function criarToken(matricula, nome) {
  const dados = Buffer.from(JSON.stringify({ m: matricula, n: nome || null, e: Date.now() + VALIDADE_S * 1000 })).toString('base64url');
  return `${dados}.${assinar(dados)}`;
}

// {matricula, nome} da sessão válida, ou null.
function sessaoDe(req) {
  if (!segredo()) return null;
  const token = lerCookie(req, COOKIE);
  if (!token || !token.includes('.')) return null;
  const [dados, assinatura] = token.split('.');
  if (!iguais(assinatura, assinar(dados))) return null;
  try {
    const { m, n, e } = JSON.parse(Buffer.from(dados, 'base64url').toString('utf-8'));
    return Date.now() < e ? { matricula: m, nome: n || null } : null;
  } catch {
    return null;
  }
}

// Matrícula da sessão válida, ou null.
export function matriculaDaSessao(req) {
  const s = sessaoDe(req);
  return s ? s.matricula : null;
}

function cabecalhoCookie(valor, maxAge) {
  const seguro = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${seguro}`;
}

function ipDe(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
}

function enviarJson(res, status, obj, cabecalhos = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabecalhos });
  res.end(JSON.stringify(obj));
}

function enviarPagina(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

function lerCorpo(req) {
  // A Vercel já entrega o corpo lido em req.body; localmente lemos o stream.
  if (req.body !== undefined) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    return Promise.resolve(JSON.parse(String(req.body || '{}')));
  }
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (c) => {
      dados += c;
      if (dados.length > 10 * 1024) req.destroy(new Error('Corpo grande demais.'));
    });
    req.on('end', () => {
      try {
        resolve(dados ? JSON.parse(dados) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

// Loga no Mercúrio e lê as filiais com Tesouraria. Devolve {filiais} ou
// {erro, status} com a mensagem pra mostrar na tela.
// Falhas do próprio navegador/servidor (não do Mercúrio nem da senha) —
// vale tentar de novo uma vez com um contexto novo.
const ERRO_DE_RECURSO = /ERR_INSUFFICIENT_RESOURCES|has been closed|disconnected|Target crashed/i;

async function verificarAcessoMercurio(matricula, senha, tentativa = 1) {
  const { abrirNavegador, login, listarFiliaisComTesouraria, lerNomeUsuarioNaTelaFuncoes } = await import('../lib/mercurioAuth.js');
  let browser;
  try {
    const aberto = await abrirNavegador({ headless: process.env.HEADLESS_DEBUG !== 'false' });
    browser = aberto.browser;
    const { page } = aberto;
    try {
      await login(page, matricula, senha);
    } catch (e) {
      // login() só termina quando o Mercúrio sai da tela de login pro menu
      // (ger_frame.php) — SÓ a espera por essa troca de página esgotar
      // (waitForURL, depois de clicar em "Entrar") indica senha recusada.
      // Antes, qualquer tempo esgotado (ex: o Mercúrio demorando a abrir)
      // virava "senha errada" e ainda contava como tentativa errada.
      if (/waitForURL/.test(e.message)) {
        return { status: 401, erro: 'O Mercúrio não aceitou essa matrícula e senha. Confira os dados e tente de novo.' };
      }
      throw e;
    }
    const filiais = await listarFiliaisComTesouraria(page);
    if (filiais.length === 0) {
      return { status: 403, erro: 'Sua matrícula entrou no Mercúrio, mas não tem o módulo Tesouraria liberado em nenhuma filial. Peça a liberação a quem administra o Mercúrio na sua filial.' };
    }
    return { filiais, nome: await lerNomeUsuarioNaTelaFuncoes(page) };
  } catch (e) {
    if (tentativa === 1 && ERRO_DE_RECURSO.test(e.message)) {
      if (browser) await browser.close();
      browser = null;
      return verificarAcessoMercurio(matricula, senha, 2);
    }
    const detalhe = String(e.message || '').split('\n')[0].slice(0, 160);
    return { status: 502, erro: `Não consegui abrir o Mercúrio agora. Tente de novo em instantes. (${detalhe})` };
  } finally {
    if (browser) await browser.close();
  }
}

async function tratarEntrar(req, res) {
  const ip = ipDe(req);
  const chaveFalhas = `falhasLogin:${ip}`;
  const falhas = await lerValor(chaveFalhas, { n: 0, desde: Date.now() });
  if (Date.now() - falhas.desde > JANELA_FALHAS_MS) Object.assign(falhas, { n: 0, desde: Date.now() });
  if (falhas.n >= MAX_FALHAS) {
    return enviarJson(res, 429, { erro: 'Muitas tentativas seguidas. Espere 15 minutos e tente de novo.' });
  }

  const corpo = await lerCorpo(req);
  const matricula = String(corpo.matricula || '').trim();
  const senha = String(corpo.senha || '').trim();
  if (!/^\d+$/.test(matricula) || !senha) {
    return enviarJson(res, 400, { erro: 'Informe sua matrícula (só números) e senha do Mercúrio.' });
  }
  const faltando = validarEnv(process.env);
  if (faltando.length) {
    return enviarJson(res, 500, { erro: `Servidor sem a credencial universal do Mercúrio configurada (${faltando.join(', ')}).` });
  }

  const resultado = await verificarAcessoMercurio(matricula, senha);
  if (resultado.erro) {
    if (resultado.status === 401) {
      falhas.n++;
      await gravarValor(chaveFalhas, falhas);
    }
    return enviarJson(res, resultado.status, { erro: resultado.erro });
  }
  if (falhas.n) await gravarValor(chaveFalhas, { n: 0, desde: Date.now() });
  return enviarJson(res, 200, { matricula, nome: resultado.nome, filiais: resultado.filiais }, { 'Set-Cookie': cabecalhoCookie(criarToken(matricula, resultado.nome), VALIDADE_S) });
}

function paginaEntrar() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tesouraria — Entrar</title>
<style>
  :root { --fundo: #f4f5f7; --cartao: #fff; --texto: #1d2330; --suave: #5b6475; --borda: #d5d9e0; --destaque: #1f6f5c; --erro: #b42318; --erro-fundo: #fef3f2; }
  @media (prefers-color-scheme: dark) { :root { --fundo: #14171d; --cartao: #1d2129; --texto: #e7eaf0; --suave: #a3abba; --borda: #333a47; --destaque: #2f9e83; --erro: #f97066; --erro-fundo: #2a1a1a; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--fundo); color: var(--texto); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  form { width: 100%; max-width: 380px; background: var(--cartao); border: 1px solid var(--borda); border-radius: 12px; padding: 28px; }
  img { display: block; max-width: 120px; margin: 0 auto 16px; }
  h1 { font-size: 1.15rem; margin: 0 0 4px; text-align: center; }
  p.sub { margin: 0 0 20px; color: var(--suave); font-size: .9rem; text-align: center; }
  label { display: block; font-size: .85rem; margin: 12px 0 6px; }
  input { width: 100%; padding: 10px 12px; border: 1px solid var(--borda); border-radius: 8px; background: transparent; color: inherit; font: inherit; }
  button { width: 100%; margin-top: 20px; padding: 10px; border: 0; border-radius: 8px; background: var(--destaque); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .7; cursor: progress; }
  .mensagem { font-size: .875rem; margin: 16px 0 0; padding: 10px 12px; border-radius: 8px; }
  .mensagem.erro { color: var(--erro); background: var(--erro-fundo); }
  .mensagem.info { color: var(--suave); padding: 0; }
</style>
</head>
<body>
<form id="formEntrar" novalidate>
  <img src="/economia/tesouraria/logo.png" alt="">
  <h1>Tesouraria — Mercúrio</h1>
  <p class="sub">Entre com sua matrícula e senha do Mercúrio. É preciso ter o módulo Tesouraria liberado.</p>
  <label for="matricula">Matrícula</label>
  <input id="matricula" name="matricula" inputmode="numeric" autocomplete="username" required autofocus>
  <label for="senha">Senha</label>
  <input id="senha" name="senha" type="password" autocomplete="current-password" required>
  <button type="submit" id="botao">Entrar</button>
  <div id="mensagem" class="mensagem" hidden></div>
</form>
<script>
  // Acesso anterior desta aba não vale mais (saiu, ou a sessão expirou).
  try { sessionStorage.removeItem('tesourariaAcesso'); } catch {}
  const form = document.getElementById('formEntrar');
  const campoMatricula = document.getElementById('matricula');
  const campoSenha = document.getElementById('senha');
  const botao = document.getElementById('botao');
  const mensagem = document.getElementById('mensagem');
  try {
    const ultima = localStorage.getItem('tesourariaUltimaMatricula');
    if (ultima) { campoMatricula.value = ultima; campoSenha.focus(); }
  } catch {}

  function mostrar(tipo, texto) {
    mensagem.hidden = false;
    mensagem.className = 'mensagem ' + tipo;
    mensagem.textContent = texto;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const matricula = campoMatricula.value.trim();
    const senha = campoSenha.value;
    if (!/^\\d+$/.test(matricula) || !senha) {
      mostrar('erro', 'Informe sua matrícula (só números) e senha do Mercúrio.');
      return;
    }
    botao.disabled = true;
    botao.textContent = 'Entrando no Mercúrio...';
    mostrar('info', 'Conferindo seu acesso à Tesouraria — leva alguns segundos.');
    try {
      const resp = await fetch('/economia/tesouraria/api/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, senha }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || 'Não foi possível entrar.');
      sessionStorage.setItem('tesourariaAcesso', JSON.stringify({ matricula, senha, nome: dados.nome || null, filiais: dados.filiais }));
      try { localStorage.setItem('tesourariaUltimaMatricula', matricula); } catch {}
      window.location.href = '/economia/tesouraria';
    } catch (erro) {
      mostrar('erro', erro.message === 'Failed to fetch' ? 'Sem conexão com o servidor. Tente de novo.' : erro.message);
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  });
</script>
</body>
</html>`;
}

// Trata /entrar, /api/entrar, /api/sessao, /sair e o bloqueio de quem não
// entrou. Devolve true se já respondeu (a requisição não deve seguir pro
// resto do servidor).
export async function tratarAutenticacao(req, res, url) {
  if (!autenticacaoAtiva()) {
    if (url.pathname === '/api/sessao') {
      enviarJson(res, 200, { autenticacao: false });
      return true;
    }
    return false;
  }

  // A logo aparece na própria tela de entrar.
  if (req.method === 'GET' && url.pathname === '/logo.png') return false;

  if (!segredo()) {
    enviarPagina(res, 503, '<p style="font-family:sans-serif;padding:16px">Configure a variável SEGREDO_SESSAO no projeto da Vercel para liberar o acesso.</p>');
    return true;
  }

  // Mostra a tela mesmo com sessão válida: a senha do Mercúrio só existe
  // na aba que entrou, então entrar de novo é o jeito de tê-la numa aba nova.
  if (url.pathname === '/entrar') {
    enviarPagina(res, 200, paginaEntrar());
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/entrar') {
    await tratarEntrar(req, res);
    return true;
  }

  if (url.pathname === '/sair') {
    res.writeHead(303, { Location: '/economia/tesouraria/entrar', 'Set-Cookie': cabecalhoCookie('', 0) });
    res.end();
    return true;
  }

  const matricula = matriculaDaSessao(req);

  if (url.pathname === '/api/sessao') {
    if (matricula) enviarJson(res, 200, { autenticacao: true, matricula, nome: sessaoDe(req).nome });
    else enviarJson(res, 401, { erro: 'Sessão expirada — entre de novo.' });
    return true;
  }

  if (matricula) return false;

  if (url.pathname.startsWith('/api/')) {
    enviarJson(res, 401, { erro: 'Sessão expirada — entre de novo com sua matrícula e senha do Mercúrio.' });
  } else {
    res.writeHead(303, { Location: '/economia/tesouraria/entrar' });
    res.end();
  }
  return true;
}
