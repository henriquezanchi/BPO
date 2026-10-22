import {
  COOKIE_OIDC,
  destinoSeguro,
  enderecoRetorno,
  KEYCLOAK,
  novoPkce,
} from "@/lib/login-acropole";
import { cookies } from "next/headers";

/** Redirecionamento com cabeçalhos alteráveis: o Next acrescenta os cookies (sessão, PKCE) gravados por cookies(). */
function redirecionar(destino: string) {
  return new Response(null, { status: 302, headers: { location: destino } });
}

/** "Entrar com a conta Nova Acrópole": vai ao Keycloak com PKCE (ver lib/login-acropole.ts). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { verifier, challenge, state, nonce } = novoPkce();
  const next = destinoSeguro(url.searchParams.get("next"));
  (await cookies()).set(
    COOKIE_OIDC,
    JSON.stringify({ verifier, state, nonce, next }),
    {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/auth/acropole",
      maxAge: 600,
    },
  );
  const destino = new URL(KEYCLOAK.auth);
  destino.search = new URLSearchParams({
    response_type: "code",
    client_id: KEYCLOAK.clientId,
    redirect_uri: enderecoRetorno(url.origin),
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return redirecionar(destino.toString());
}
