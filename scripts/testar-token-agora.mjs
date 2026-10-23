// Teste local: o token do aluno emitido para o client `portal-aluno` abre a API do Ágora?
// Faz o login unificado (PKCE) com retorno em localhost:3000, troca o código e chama o Ágora
// com Authorization: Bearer. Não imprime tokens nem dados pessoais: só status, aud/azp/scope
// e os NOMES dos campos devolvidos.
import crypto from "node:crypto";
import http from "node:http";
import { exec } from "node:child_process";

const BASE = "https://auth.acropolebrasil.com.br/as/realms/oinabnb/protocol/openid-connect";
const CLIENT = "portal-aluno";
const RETORNO = "http://localhost:3000/auth/acropole/callback";
const AGORA = "https://eventos.acropolebrasil.com.br/api";

const b64 = (b) => b.toString("base64url");
const verifier = b64(crypto.randomBytes(32));
const challenge = b64(crypto.createHash("sha256").update(verifier).digest());
const state = b64(crypto.randomBytes(16));
const nonce = b64(crypto.randomBytes(16));

const auth = new URL(`${BASE}/auth`);
auth.search = new URLSearchParams({
  response_type: "code",
  client_id: CLIENT,
  redirect_uri: RETORNO,
  scope: "openid profile email",
  state,
  nonce,
  code_challenge: challenge,
  code_challenge_method: "S256",
}).toString();

const jwt = (t) => JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
const chaves = (v) =>
  Array.isArray(v) ? `lista com ${v.length} itens${v[0] && typeof v[0] === "object" ? `; campos: ${Object.keys(v[0]).join(",")}` : ""}`
  : v && typeof v === "object" ? `campos: ${Object.keys(v).join(",")}` : typeof v;

async function testar(token) {
  const p = jwt(token);
  console.log("\n== Token de acesso do portal-aluno");
  console.log("iss:", p.iss);
  console.log("aud:", JSON.stringify(p.aud ?? null), "| azp:", p.azp, "| scope:", p.scope);
  console.log("validade (min):", Math.round((p.exp - p.iat) / 60));
  console.log("papéis de client:", JSON.stringify(Object.keys(p.resource_access ?? {})));

  const hoje = new Date();
  const fim = new Date(hoje.getTime() + 60 * 864e5);
  const d = (x) => x.toISOString().slice(0, 10);
  const alvos = [
    "/usuarios/usuario-logado",
    `/eventos/periodo?ini=${d(hoje)}&fim=${d(fim)}`,
    "/eventos/inscricoes/minha",
    "/sedes",
  ];
  console.log("\n== Ágora com Authorization: Bearer");
  for (const a of alvos) {
    const r = await fetch(AGORA + a, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json", "user-agent": "Mozilla/5.0" },
    });
    const txt = await r.text();
    let resumo = `${txt.length} bytes`;
    try {
      const j = JSON.parse(txt);
      resumo = r.ok ? chaves(j) : JSON.stringify(j).slice(0, 200);
    } catch {}
    console.log(`${r.status} ${a.split("?")[0]} -> ${resumo}`);
  }
}

const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost:3000");
  if (u.pathname !== "/auth/acropole/callback") return res.writeHead(404).end();
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end("<p>Pronto. Pode fechar esta aba e voltar ao VS Code.</p>");
  try {
    if (u.searchParams.get("error")) throw new Error("login recusado: " + u.searchParams.get("error"));
    if (u.searchParams.get("state") !== state) throw new Error("state não confere");
    const r = await fetch(`${BASE}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: u.searchParams.get("code"),
        redirect_uri: RETORNO,
        client_id: CLIENT,
        code_verifier: verifier,
      }),
    });
    if (!r.ok) throw new Error(`troca do código falhou: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const t = await r.json();
    console.log("refresh_token recebido:", Boolean(t.refresh_token), "| validade refresh (min):", Math.round((t.refresh_expires_in ?? 0) / 60));
    await testar(t.access_token);
  } catch (e) {
    console.error("ERRO:", e.message);
  } finally {
    srv.close();
  }
});

srv.listen(3000, () => {
  console.log("Abrindo o login unificado no navegador...");
  exec(`start "" "${auth.toString()}"`);
  setTimeout(() => { console.error("Tempo esgotado (5 min) sem login."); process.exit(1); }, 300_000).unref();
});
