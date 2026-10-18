/**
 * Leitura do banco de consulta do Mercúrio antigo ("oinabview", cópia
 * diária do Mercúrio de verdade — atualização registrada na tabela
 * `atualização`). Responsável: João Guilherme.
 *
 * Não há acesso direto ao MySQL (porta fechada pra fora): a única porta
 * de entrada é o phpMyAdmin, atrás de 2 logins — o do Apache
 * (MERCURIO_DB_HTTP_USUARIO/SENHA, "Restricted Files") e o do próprio
 * phpMyAdmin (MERCURIO_PMA_USER/PASS, usuário só-leitura). Aqui a gente
 * dirige a tela de SQL dele por HTTP e lê a tabela de resultado.
 *
 * Frágil por natureza (atualização de versão do phpMyAdmin pode mudar o
 * HTML) — se quebrar, o pedido certo é um acesso MySQL só-leitura direto.
 *
 * Sem parâmetros preparados: phpMyAdmin só aceita SQL pronto. Todo valor
 * vindo de usuário PRECISA passar por sqlTexto()/sqlNumero() abaixo.
 * Só usar em código de servidor (Server Action, worker, script).
 */
const BANCO = "oinabview";

type Linha = Record<string, string | null>;

let sessao: { cookies: Map<string, string>; token: string; criadaEm: number } | null = null;
const VALIDADE_SESSAO_MS = 20 * 60 * 1000;

function config() {
  const e = process.env;
  const url = e.MERCURIO_PMA_URL?.replace(/\/$/, "");
  if (!url || !e.MERCURIO_PMA_USER || !e.MERCURIO_PMA_PASS || !e.MERCURIO_DB_HTTP_USUARIO || !e.MERCURIO_DB_HTTP_SENHA) {
    throw new Error("Banco de consulta do Mercúrio não configurado (MERCURIO_PMA_* / MERCURIO_DB_HTTP_*).");
  }
  return {
    url,
    basic: "Basic " + Buffer.from(`${e.MERCURIO_DB_HTTP_USUARIO}:${e.MERCURIO_DB_HTTP_SENHA}`).toString("base64"),
    usuario: e.MERCURIO_PMA_USER,
    senha: e.MERCURIO_PMA_PASS,
  };
}

async function requisicao(cookies: Map<string, string>, path: string, init: RequestInit = {}) {
  const { url, basic } = config();
  const res = await fetch(url + path, {
    ...init,
    redirect: "manual",
    cache: "no-store",
    headers: {
      Authorization: basic,
      Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      ...(init.headers ?? {}),
    },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [par] = c.split(";");
    const i = par.indexOf("=");
    cookies.set(par.slice(0, i), par.slice(i + 1));
  }
  return res;
}

function tokenDe(html: string): string | undefined {
  return (html.match(/name="token" value="([^"]+)"/) ?? html.match(/"token":"([^"]+)"/))?.[1];
}

async function abrirSessao() {
  const { usuario, senha } = config();
  const cookies = new Map<string, string>();
  const telaLogin = await requisicao(cookies, "/index.php");
  if (telaLogin.status === 401) throw new Error("Banco do Mercúrio: login do servidor (Apache) recusado.");
  const tokenLogin = tokenDe(await telaLogin.text());
  if (!tokenLogin) throw new Error("Banco do Mercúrio: tela de login do phpMyAdmin não reconhecida.");

  await requisicao(cookies, "/index.php?route=/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ pma_username: usuario, pma_password: senha, server: "1", token: tokenLogin, set_session: cookies.get("phpMyAdmin_https") ?? "" }),
  });
  const home = await (await requisicao(cookies, `/index.php?route=/&db=${BANCO}`)).text();
  if (/name="pma_username"/.test(home)) throw new Error("Banco do Mercúrio: login do phpMyAdmin recusado.");
  const token = tokenDe(home);
  if (!token) throw new Error("Banco do Mercúrio: token de sessão não encontrado.");
  sessao = { cookies, token, criadaEm: Date.now() };
  return sessao;
}

function decodificar(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function lerTabela(html: string): Linha[] {
  const tabela = html.match(/<table[^>]*table_results[\s\S]*?<\/table>/)?.[0];
  if (!tabela) return [];
  const colunas = [...tabela.matchAll(/data-column="([^"]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
  return [...tabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/<td[^>]*class="([^"]*\bdata\b[^"]*)"[^>]*>([\s\S]*?)<\/td>/g)])
    .filter((celulas) => celulas.length)
    .map((celulas) =>
      Object.fromEntries(colunas.map((c, k) => [c, celulas[k] && /\bnull\b/.test(celulas[k][1]) ? null : celulas[k] ? decodificar(celulas[k][2]) : null])),
    );
}

/** Roda um SELECT e devolve as linhas (todos os valores como texto, NULL como null). Máx. 5000 linhas por chamada. */
export async function consultarMercurio(sql: string, tentativa = 0): Promise<Linha[]> {
  const s = sessao && Date.now() - sessao.criadaEm < VALIDADE_SESSAO_MS ? sessao : await abrirSessao();
  const res = await requisicao(s.cookies, "/index.php?route=/sql", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
    body: new URLSearchParams({
      token: s.token,
      db: BANCO,
      server: "1",
      sql_query: sql,
      ajax_request: "true",
      session_max_rows: "5000",
      pos: "0",
      // Texto completo — sem isso o phpMyAdmin corta campos longos com "..." (visto ao vivo: endereço truncado).
      display_options_form: "1",
      pftext: "F",
    }),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; error?: string } | null;
  if (!json?.success) {
    // Sessão expirada no servidor: abre de novo 1 vez.
    if (tentativa === 0) {
      sessao = null;
      return consultarMercurio(sql, 1);
    }
    throw new Error(`Banco do Mercúrio: consulta falhou — ${decodificar(json?.error ?? `HTTP ${res.status}`).slice(0, 300)}`);
  }
  return lerTabela(json.message ?? "");
}

/** Escapa um texto pra entrar entre aspas simples no SQL. */
export function sqlTexto(valor: string): string {
  return "'" + valor.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\0/g, "") + "'";
}

/** Garante que é só dígitos (matrícula, CPF) antes de entrar no SQL. */
export function sqlNumero(valor: string | number): string {
  const s = String(valor);
  if (!/^\d+$/.test(s)) throw new Error(`Valor numérico inválido pro banco do Mercúrio: ${s}`);
  return s;
}
