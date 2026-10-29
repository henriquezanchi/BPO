import { db } from "@/lib/db";
import { renovarTokens, type TokensAcropole } from "@/lib/login-acropole";
import { fetchAcropole } from "@/lib/ponte";
import { cifrar, decifrar } from "@/lib/segredo-cifrado";

/**
 * Túnel do Ágora (pedido do usuário 2026-10-27; combinado com o Marcos): o Portal chama a API do Ágora como o próprio
 * aluno, com o token que o Keycloak entregou no login unificado (client `portal-aluno`, papel `agora_login`). O Ágora
 * valida o token, acha o usuário e devolve um cookie de sessão dele; nas chamadas seguintes o Portal manda só o cookie
 * (pedido do Marcos: não consultar o banco do Ágora a cada chamada). O cookie dura 1 dia e é renovado a cada uso
 * (29/10/2026): enquanto o aluno abrir o Portal ao menos uma vez por dia, não depende mais do prazo do Keycloak. Tokens e cookie ficam cifrados em `SessaoAgora`.
 * Sem sessão válida (aluno entrou com senha, ou o login unificado expirou), o Ágora simplesmente não aparece.
 */
export const AGORA = "https://eventos.acropolebrasil.com.br";
const FINALIDADE = "sessao-agora";
const MARGEM_MS = 60_000;
// Cookie de sessão do Ágora: dura 1 dia e é renovado a cada requisição (Marcos, 29/10/2026). Usado enquanto o Ágora
// aceitar; sem prazo no Set-Cookie, vale 1 dia a partir do último uso.
const COOKIE_DIA_MS = 24 * 60 * 60 * 1000;

export class SemSessaoAgora extends Error {}

/** Guarda os tokens do login (callback do login unificado). Zera o cookie: ele é de uma sessão anterior. */
export async function salvarSessaoAgora(memberId: string, t: TokensAcropole) {
  const dados = {
    accessCifrado: cifrar(t.access, FINALIDADE),
    refreshCifrado: t.refresh ? cifrar(t.refresh, FINALIDADE) : null,
    accessExpiraEm: t.accessExpiraEm,
    refreshExpiraEm: t.refreshExpiraEm,
    cookieCifrado: null,
    cookieAte: null,
    falhaEm: null,
    falha: null,
  };
  await db.sessaoAgora.upsert({ where: { memberId }, update: dados, create: { memberId, ...dados } });
}

/** Token válido do aluno, renovando pelo refresh quando preciso. null = precisa entrar de novo pelo login unificado. */
async function tokenDoAluno(memberId: string): Promise<string | null> {
  const s = await db.sessaoAgora.findUnique({ where: { memberId } });
  if (!s) return null;
  if (s.accessExpiraEm.getTime() - Date.now() > MARGEM_MS) return decifrar(s.accessCifrado, FINALIDADE);
  if (!s.refreshCifrado || !s.refreshExpiraEm || s.refreshExpiraEm.getTime() - Date.now() < MARGEM_MS) return null;
  const novos = await renovarTokens(decifrar(s.refreshCifrado, FINALIDADE));
  if (!novos) {
    // Mantém a linha (sem o refresh) para a Agenda saber que precisa reconectar (ver agoraPrecisaReconectar).
    await db.sessaoAgora.update({ where: { memberId }, data: { refreshCifrado: null, refreshExpiraEm: null, cookieCifrado: null, cookieAte: null } }).catch(() => {});
    return null;
  }
  await salvarSessaoAgora(memberId, novos);
  return novos.access;
}

/**
 * Junta os Set-Cookie da resposta ao cookie que já tínhamos (mesmo nome = valor novo) e calcula até quando vale:
 * Max-Age/Expires do Set-Cookie, ou 1 dia a partir de agora. Sem Set-Cookie, o cookie anterior ganha mais 1 dia (o
 * Ágora renova a sessão a cada requisição).
 */
export function cookieRenovado(anterior: string | null, setCookies: string[], agora = Date.now()): { cookie: string; ate: number } | null {
  const pares = new Map((anterior ?? "").split(";").map((p) => p.trim()).filter((p) => p.includes("=")).map((p) => [p.slice(0, p.indexOf("=")), p] as const));
  let ate = agora + COOKIE_DIA_MS;
  for (const c of setCookies) {
    const [par, ...atributos] = c.split(";").map((x) => x.trim());
    if (!par?.includes("=")) continue;
    const nome = par.slice(0, par.indexOf("="));
    const maxAge = atributos.find((a) => /^max-age=/i.test(a));
    const expires = atributos.find((a) => /^expires=/i.test(a));
    const fim = maxAge ? agora + Number(maxAge.split("=")[1]) * 1000 : expires ? Date.parse(expires.slice(8)) : NaN;
    if (par.slice(nome.length + 1) === "" || (Number.isFinite(fim) && fim <= agora)) {
      pares.delete(nome); // o Ágora apagou este cookie
      continue;
    }
    pares.set(nome, par);
    if (Number.isFinite(fim)) ate = Math.min(ate, fim);
  }
  return pares.size ? { cookie: [...pares.values()].join("; "), ate } : null;
}

const setCookiesDe = (r: Response) => (typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [r.headers.get("set-cookie") ?? ""].filter(Boolean));

async function guardarCookie(memberId: string, anterior: string | null, r: Response) {
  const novo = cookieRenovado(anterior, setCookiesDe(r));
  if (!novo) return;
  await db.sessaoAgora.update({ where: { memberId }, data: { cookieCifrado: cifrar(novo.cookie, FINALIDADE), cookieAte: new Date(novo.ate), falhaEm: null, falha: null } });
}

/** GET na API do Ágora como o aluno (pela ponte). Lança SemSessaoAgora quando não há como autenticar. */
export async function chamarAgora<T>(memberId: string, caminho: string): Promise<T> {
  const url = `${AGORA}${caminho}`;
  const base = { accept: "application/json" };
  const s = await db.sessaoAgora.findUnique({ where: { memberId }, select: { cookieCifrado: true, cookieAte: true } });

  // 1) Cookie da sessão do Ágora, enquanto valer; cada uso renova (o Ágora estende a sessão a cada requisição).
  if (s?.cookieCifrado && s.cookieAte && s.cookieAte.getTime() > Date.now()) {
    const cookie = decifrar(s.cookieCifrado, FINALIDADE);
    const r = await fetchAcropole(url, { headers: { ...base, cookie }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (r.ok) {
      await guardarCookie(memberId, cookie, r);
      return (await r.json()) as T;
    }
    // 403 = esta rota não é liberada para a pessoa (visto em /eventos/periodo), não sessão vencida: mantém o cookie.
    if (r.status !== 401) throw new Error(`Ágora ${caminho} -> ${r.status}`);
    await db.sessaoAgora.update({ where: { memberId }, data: { cookieCifrado: null, cookieAte: null } });
  }

  // 2) Token do login unificado; o Ágora devolve um cookie novo, guardado para as próximas chamadas.
  const token = await tokenDoAluno(memberId);
  if (!token) throw new SemSessaoAgora("Sem sessão do login unificado para o Ágora.");
  const r = await fetchAcropole(url, { headers: { ...base, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!r.ok) {
    await db.sessaoAgora.update({ where: { memberId }, data: { falhaEm: new Date(), falha: `${caminho} -> ${r.status}` } }).catch(() => {});
    if (r.status === 401 || r.status === 403) throw new SemSessaoAgora(`Ágora recusou o token (${r.status}).`);
    throw new Error(`Ágora ${caminho} -> ${r.status}`);
  }
  if (setCookiesDe(r).length) await guardarCookie(memberId, null, r);
  return (await r.json()) as T;
}

/**
 * A sessão do Ágora venceu e não dá mais para renovar (29/10/2026: o login do Portal dura semanas, a sessão do Keycloak
 * não passa de um dia; os eventos do Ágora sumiam da Agenda sem aviso). Só para quem já entrou pelo login unificado.
 */
export async function agoraPrecisaReconectar(memberId: string): Promise<boolean> {
  const s = await db.sessaoAgora.findUnique({ where: { memberId }, select: { accessExpiraEm: true, refreshExpiraEm: true, refreshCifrado: true, cookieCifrado: true, cookieAte: true } });
  if (!s) return false;
  const agora = Date.now() + MARGEM_MS;
  if (s.accessExpiraEm.getTime() > agora) return false;
  if (s.cookieCifrado && s.cookieAte && s.cookieAte.getTime() > agora) return false;
  return !(s.refreshCifrado && s.refreshExpiraEm && s.refreshExpiraEm.getTime() > agora);
}
