import { db } from "@/lib/db";
import { renovarTokens, type TokensAcropole } from "@/lib/login-acropole";
import { fetchAcropole } from "@/lib/ponte";
import { cifrar, decifrar } from "@/lib/segredo-cifrado";

/**
 * Túnel do Ágora (pedido do usuário 2026-10-27; combinado com o Marcos): o Portal chama a API do Ágora como o próprio
 * aluno, com o token que o Keycloak entregou no login unificado (client `portal-aluno`, papel `agora_login`). O Ágora
 * valida o token, acha o usuário e devolve um cookie de sessão dele; nas chamadas seguintes o Portal manda só o cookie
 * (pedido do Marcos: não consultar o banco do Ágora a cada chamada). Tokens e cookie ficam cifrados em `SessaoAgora`.
 * Sem sessão válida (aluno entrou com senha, ou o login unificado expirou), o Ágora simplesmente não aparece.
 */
export const AGORA = "https://eventos.acropolebrasil.com.br";
const FINALIDADE = "sessao-agora";
const MARGEM_MS = 60_000;
const COOKIE_MAX_MS = 2 * 60 * 60 * 1000;

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
    await db.sessaoAgora.delete({ where: { memberId } }).catch(() => {});
    return null;
  }
  await salvarSessaoAgora(memberId, novos);
  return novos.access;
}

/** "nome=valor; nome2=valor2" a partir dos Set-Cookie da resposta (só o par nome=valor de cada um). */
function cookieDaResposta(r: Response): string | null {
  const lista = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [r.headers.get("set-cookie") ?? ""].filter(Boolean);
  const pares = lista.map((c) => c.split(";")[0]?.trim()).filter((c): c is string => !!c && c.includes("="));
  return pares.length ? pares.join("; ") : null;
}

/** GET na API do Ágora como o aluno (pela ponte). Lança SemSessaoAgora quando não há como autenticar. */
export async function chamarAgora<T>(memberId: string, caminho: string): Promise<T> {
  const url = `${AGORA}${caminho}`;
  const base = { accept: "application/json" };
  const s = await db.sessaoAgora.findUnique({ where: { memberId }, select: { cookieCifrado: true, cookieAte: true } });

  // 1) Cookie da sessão do Ágora, enquanto valer.
  if (s?.cookieCifrado && s.cookieAte && s.cookieAte.getTime() > Date.now()) {
    const r = await fetchAcropole(url, { headers: { ...base, cookie: decifrar(s.cookieCifrado, FINALIDADE) }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (r.ok) return (await r.json()) as T;
    if (r.status !== 401 && r.status !== 403) throw new Error(`Ágora ${caminho} -> ${r.status}`);
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
  const cookie = cookieDaResposta(r);
  if (cookie) {
    const sessao = await db.sessaoAgora.findUnique({ where: { memberId }, select: { accessExpiraEm: true } });
    const ate = Math.min(Date.now() + COOKIE_MAX_MS, sessao?.accessExpiraEm.getTime() ?? Date.now() + COOKIE_MAX_MS);
    await db.sessaoAgora.update({ where: { memberId }, data: { cookieCifrado: cifrar(cookie, FINALIDADE), cookieAte: new Date(ate), falhaEm: null, falha: null } });
  }
  return (await r.json()) as T;
}
