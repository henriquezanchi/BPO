import { fetchAcropole } from "@/lib/ponte";
import crypto from "node:crypto";

/**
 * Login unificado da Nova Acrópole (Keycloak do Marcos, realm oinabnb) —
 * pedido do usuário 2026-10-22. Client público `portal-aluno` com PKCE (sem
 * segredo, como os outros sistemas — orientação do Heitor). A ida ao login é
 * pelo navegador da pessoa; a troca do código pelo token passa pela ponte na
 * Cloudflare (o Cloudflare deles desafia a Vercel — lib/ponte.ts).
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

type Token = { access_token: string; id_token?: string };
export type PessoaAcropole = {
  sub: string;
  email: string | null;
  emailVerificado: boolean;
  nome: string | null;
  claims: string[];
};

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
    client_id: KEYCLOAK.clientId,
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
  };
}
