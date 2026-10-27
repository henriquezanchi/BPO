/**
 * Liga a subconta Asaas de uma filial ao Portal (regra do usuário 2026-10-25: toda cobrança sai pela subconta da
 * filial, nunca pela conta principal). Passos:
 *  1. pede a chave de API da subconta SEM mostrar na tela (gerada pela própria subconta em Integrações > Chaves de API);
 *  2. confere que a chave é da carteira já cadastrada para a filial (School.asaasWalletId);
 *  3. guarda em School.asaasSubaccountApiKey;
 *  4. cadastra na subconta o mesmo webhook do Portal (URL, eventos e token da conta principal), para os pagamentos
 *     se confirmarem sozinhos.
 * Nunca imprime a chave nem o token.
 *
 * Uso (no terminal, para colar a chave): npx tsx scripts/ligar-subconta-asaas.ts BGA
 *      (chave já no .env.local):          npx tsx --env-file=.env --env-file=.env.local scripts/ligar-subconta-asaas.ts BGA --da-env ASAAS_API_KEY_BG
 */
import { loadEnvConfig } from "@next/env";
import * as readline from "node:readline";
// O carregador do Next trata o "$" das chaves do Asaas ("$aact_…") como variável e as esvazia; com as variáveis já
// carregadas (npx tsx --env-file=.env --env-file=.env.local …), ele não é chamado.
if (!process.env.ASAAS_API_KEY) loadEnvConfig(process.cwd());

const BASE = process.env.ASAAS_ENV === "sandbox" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";

function perguntarOculto(texto: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const saida = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let mostrouPergunta = false;
    saida._writeToOutput = (s: string) => {
      if (!mostrouPergunta) {
        saida.output.write(s);
        mostrouPergunta = true;
      } else if (s.includes("\n")) saida.output.write("\n");
    };
    rl.question(texto, (r) => {
      rl.close();
      resolve(r.trim());
    });
  });
}

async function asaas<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { access_token: apiKey, "Content-Type": "application/json", "User-Agent": "portal-na", ...init?.headers } });
  if (!res.ok) throw new Error(`Asaas ${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

async function main() {
  const unidade = process.argv[2]?.toUpperCase();
  if (!unidade) throw new Error("Informe a unidade do Mercúrio. Ex.: npx tsx scripts/ligar-subconta-asaas.ts BGA");
  const principal = process.env.ASAAS_API_KEY;
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!principal || !token) throw new Error("ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN precisam estar no .env.");

  const { db } = await import("../src/lib/db");
  const escola = await db.school.findUnique({ where: { mercurioUnidade: unidade }, select: { id: true, name: true, asaasWalletId: true, asaasSubaccountApiKey: true } });
  if (!escola) throw new Error(`Unidade ${unidade} não encontrada.`);
  if (!escola.asaasWalletId) throw new Error(`${escola.name} ainda não tem subconta Asaas (asaasWalletId vazio).`);
  console.log(`Filial: ${escola.name}${escola.asaasSubaccountApiKey ? " (já tinha chave; será substituída)" : ""}`);

  // --da-env NOME: lê a chave de uma variável do .env/.env.local (ex.: ASAAS_API_KEY_BG), sem mostrar.
  const daEnv = process.argv.indexOf("--da-env");
  const chave = daEnv > 0 ? (process.env[process.argv[daEnv + 1] ?? ""] ?? "").trim() : await perguntarOculto("Cole a chave de API da subconta e tecle Enter (não aparece na tela): ");
  if (!chave.startsWith("$aact_")) throw new Error("Isso não parece uma chave de API do Asaas (começa com $aact_).");

  // 2. A chave precisa ser da carteira da filial.
  const carteiras = await asaas<{ data: { id: string }[] }>(chave, "/wallets");
  if (!carteiras.data.some((c) => c.id === escola.asaasWalletId)) throw new Error("A chave não é da subconta desta filial (carteira diferente). Nada foi gravado.");
  const conta = await asaas<{ name?: string; companyName?: string }>(chave, "/myAccount/commercialInfo").catch(() => ({}) as { name?: string });
  console.log(`Chave confere com a carteira da filial. Nome que aparece nas cobranças: ${conta.name ?? "(não informado)"}`);

  // 3. Guarda.
  await db.school.update({ where: { id: escola.id }, data: { asaasSubaccountApiKey: chave } });
  console.log("Chave guardada no Portal.");

  // 4. Webhook igual ao da conta principal.
  const modelo = (await asaas<{ data: { url: string; email: string; events: string[]; apiVersion?: number }[] }>(principal, "/webhooks")).data.find((w) => w.url.includes("/api/webhooks/asaas"));
  if (!modelo) throw new Error("Webhook do Portal não encontrado na conta principal; cadastre o webhook da subconta pelo painel.");
  const existentes = (await asaas<{ data: { url: string }[] }>(chave, "/webhooks")).data;
  if (existentes.some((w) => w.url === modelo.url)) {
    console.log("A subconta já tem o webhook do Portal.");
  } else {
    const cadastrar = (events: string[]) =>
      asaas(chave, "/webhooks", {
        method: "POST",
        body: JSON.stringify({ name: "Portal Nova Acrópole", url: modelo.url, email: modelo.email, enabled: true, interrupted: false, authToken: token, sendType: "NON_SEQUENTIALLY", events }),
      });
    let eventos = modelo.events;
    try {
      await cadastrar(eventos);
    } catch (e) {
      // Subconta sem Pix Automático liberado (visto em BGA, 27/10/2026): cadastra sem esses eventos.
      if (!/Pix Autom/i.test(String(e))) throw e;
      eventos = eventos.filter((ev) => !ev.startsWith("PIX_AUTOMATIC"));
      await cadastrar(eventos);
      console.log("Pix Automático não está liberado nesta subconta: avisos de Pix Automático ficaram de fora.");
    }
    console.log(`Webhook cadastrado na subconta (${eventos.length} eventos).`);
  }
  console.log("Pronto: as cobranças desta filial saem pela subconta.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
