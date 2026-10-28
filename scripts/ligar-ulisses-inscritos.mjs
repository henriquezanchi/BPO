// Liga a consulta de inscritos do Ulisses no Portal (27/10/2026): copia a credencial M2M da API do Ulisses que o CRM já
// usa (guardada cifrada no banco do CRM, "Login Automático" → ulisses_api) para o .env do Portal e para a Vercel, sem
// mostrar os valores. Uso: node scripts/ligar-ulisses-inscritos.mjs [caminho do .env do scraper do CRM]
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const lerEnv = (arquivo) =>
  new Map(
    readFileSync(arquivo, "utf8")
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.trim().replace(/^["'](.*)["']$/, "$1")]),
  );

const crm = lerEnv(process.argv[2] ?? "C:/Scrapper/scraper/.env");
for (const nome of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CREDENCIAIS_SCRAPER_CHAVE"]) if (!crm.get(nome)) throw new Error(`${nome} não está no .env do CRM.`);

const r = await fetch(`${crm.get("SUPABASE_URL")}/rest/v1/rpc/ler_credencial_scraper`, {
  method: "POST",
  headers: { apikey: crm.get("SUPABASE_SERVICE_ROLE_KEY"), authorization: `Bearer ${crm.get("SUPABASE_SERVICE_ROLE_KEY")}`, "content-type": "application/json" },
  body: JSON.stringify({ p_sistema: "ulisses_api", p_filial: "GLOBAL", p_chave: crm.get("CREDENCIAIS_SCRAPER_CHAVE") }),
});
const [cred] = r.ok ? await r.json() : [];
if (!cred?.usuario || !cred?.senha) throw new Error(`Credencial do Ulisses não encontrada no CRM (HTTP ${r.status}).`);

// Confere a credencial antes de gravar.
const t = await fetch("https://acropolebrasil.us.auth0.com/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ client_id: cred.usuario, client_secret: cred.senha, audience: "https://api.acropolebrasil.com.br/", grant_type: "client_credentials" }),
});
console.log(`Credencial do Ulisses: ${t.ok ? "válida" : `recusada (HTTP ${t.status})`}`);
if (!t.ok) process.exit(1);

const linhas = readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => !/^ULISSES_API_CLIENT_(ID|SECRET)=/.test(l));
while (linhas.at(-1) === "") linhas.pop();
writeFileSync(".env", `${[...linhas, `ULISSES_API_CLIENT_ID=${cred.usuario}`, `ULISSES_API_CLIENT_SECRET=${cred.senha}`].join("\n")}\n`);
console.log(".env do Portal: ULISSES_API_CLIENT_ID e ULISSES_API_CLIENT_SECRET gravadas.");

spawnSync("node", ["scripts/copiar-env-vercel.mjs", "ULISSES_API_CLIENT_ID", "ULISSES_API_CLIENT_SECRET"], { stdio: "inherit", shell: true });
