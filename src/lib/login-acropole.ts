import { fetchAcropole } from "@/lib/ponte";
import crypto from "node:crypto";

/**
 * Login unificado da Nova Acrópole (Keycloak do Marcos, realm oinabnb) —
 * pedido do usuário 2026-10-22. Client `portal-aluno` com PKCE. A ida ao login
 * é pelo navegador da pessoa; a troca do código pelo token passa pela ponte na
 * Cloudflare (o Cloudflare deles desafia a Vercel — lib/ponte.ts).
 *
 * O client nasceu público; em 23/10 o usuário decidiu torná-lo confidencial
 * para usar o token exchange do Keycloak (chamar o Ágora com o token do
 * próprio aluno — o Keycloak não deixa client público trocar token). Com
 * KEYCLOAK_CLIENT_SECRET definido, o segredo vai junto em toda chamada ao
 * endpoint de token; sem ele, segue como client público.
 */
export const KEYCLOAK = {
  base: "https://auth.acropolebrasil.com.br/as/realms/oinabnb",
  clientId: "portal-aluno",
  get auth() {
    return `${this.base}/protocol/openid-connect/auth`;
  },
  get token() {
    return `${this.base}/protocol/openid-connect/token`;
  },
  get userinfo() {
    return `${this.base}/protocol/openid-connect/userinfo`;
  },
};

export const COOKIE_OIDC = "na_login_acropole";

const b64url = (b: Buffer) => b.toString("base64url");
export function novoPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(
    crypto.createHash("sha256").update(verifier).digest(),
  );
  return {
    verifier,
    challenge,
    state: b64url(crypto.randomBytes(16)),
    nonce: b64url(crypto.randomBytes(16)),
  };
}

/** Endereço de retorno cadastrado no Keycloak (produção e localhost:3000). */
export function enderecoRetorno(origem: string) {
  return `${origem}/auth/acropole/callback`;
}

/** Só caminhos internos do Portal depois do login. */
export function destinoSeguro(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/portal";
}

/** Identificação do client no endpoint de token (client_secret_post quando confidencial). */
function credenciaisCliente(): Record<string, string> {
  const segredo = process.env.KEYCLOAK_CLIENT_SECRET;
  return segredo
    ? { client_id: KEYCLOAK.clientId, client_secret: segredo }
    : { client_id: KEYCLOAK.clientId };
}

type Token = { access_token: string; id_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number };
/** Tokens do aluno no login unificado, guardados cifrados para o túnel do Ágora (lib/agora/sessao.ts). */
export type TokensAcropole = { access: string; refresh: string | null; accessExpiraEm: Date; refreshExpiraEm: Date | null };
export type PessoaAcropole = {
  sub: string;
  email: string | null;
  emailVerificado: boolean;
  nome: string | null;
  claims: string[];
  tokens: TokensAcropole;
};

function tokensDe(t: Token): TokensAcropole {
  const agora = Date.now();
  return {
    access: t.access_token,
    refresh: t.refresh_token ?? null,
    accessExpiraEm: new Date(agora + (t.expires_in ?? 300) * 1000),
    // refresh_expires_in = 0 significa "sem prazo próprio" (sessão offline); tratamos como 12 h.
    refreshExpiraEm: t.refresh_token ? new Date(agora + (t.refresh_expires_in || 12 * 3600) * 1000) : null,
  };
}

/** Renova o token do aluno pelo refresh (túnel do Ágora). null = sessão do login unificado encerrada: precisa entrar de novo. */
export async function renovarTokens(refresh: string): Promise<TokensAcropole | null> {
  const r = await fetchAcropole(KEYCLOAK.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, ...credenciaisCliente() }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (r.status === 400 || r.status === 401) return null;
  if (!r.ok) throw new Error(`Login da Nova Acrópole não renovou a sessão (${r.status}).`);
  return tokensDe((await r.json()) as Token);
}

function lerJwt(jwt: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"),
  );
}

/**
 * Troca o código pelo token (PKCE) e confere o id_token. O id_token vem
 * direto do endpoint de token por TLS (passando só pela nossa ponte), o que o
 * OpenID Connect aceita no lugar de checar a assinatura; conferimos emissor,
 * destinatário, nonce e validade.
 */
export async function trocarCodigo(
  code: string,
  verifier: string,
  nonce: string,
  origem: string,
): Promise<PessoaAcropole> {
  const corpo = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: enderecoRetorno(origem),
    ...credenciaisCliente(),
    code_verifier: verifier,
  });
  const r = await fetchAcropole(KEYCLOAK.token, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: corpo.toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok)
    throw new Error(
      `Login da Nova Acrópole recusou o código (${r.status}${r.headers.get("cf-mitigated") ? ", bloqueio do Cloudflare" : ""}).`,
    );
  const token = (await r.json()) as Token;
  if (!token.id_token)
    throw new Error("Login da Nova Acrópole não devolveu a identificação.");

  const id = lerJwt(token.id_token);
  const aud = Array.isArray(id.aud) ? id.aud : [id.aud];
  if (id.iss !== KEYCLOAK.base) throw new Error("Emissor do login inesperado.");
  if (!aud.includes(KEYCLOAK.clientId) && id.azp !== KEYCLOAK.clientId)
    throw new Error("Login emitido para outro sistema.");
  if (id.nonce !== nonce)
    throw new Error("Login expirado ou repetido. Tente de novo.");
  if (typeof id.exp !== "number" || id.exp * 1000 < Date.now())
    throw new Error("Login expirado. Tente de novo.");

  // Dados de perfil (e-mail) podem vir só no userinfo, conforme a configuração do client.
  let info: Record<string, unknown> = id;
  if (!id.email) {
    const u = await fetchAcropole(KEYCLOAK.userinfo, {
      headers: {
        authorization: `Bearer ${token.access_token}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (u.ok)
      info = { ...id, ...((await u.json()) as Record<string, unknown>) };
  }
  const email =
    typeof info.email === "string" ? info.email.trim().toLowerCase() : null;
  return {
    sub: String(id.sub),
    email,
    // Só e-mail confirmado no Keycloak: o "Cadastre-se" de lá não pode servir para entrar como outra pessoa.
    emailVerificado: info.email_verified === true,
    nome: typeof info.name === "string" ? info.name : null,
    // Só os nomes dos campos (sem valores), para saber o que o Keycloak manda se o e-mail não bastar.
    claims: Object.keys(info),
    tokens: tokensDe(token),
  };
}
