/**
 * Captura telas REAIS do Portal em produção para o passo a passo dos membros (23/11/2026, pedido do usuário).
 * Sessão aberta pelo servidor (link mágico + verifyOtp, como o callback do login unificado) na conta do dono do
 * sistema; nome trocado por um fictício antes de cada captura; nada é pago (para antes de "Pagar"). A sessão é
 * encerrada no fim (signOut). Saída: docs/guias/telas/*.png (390×844, escala 3).
 * Uso: npx tsx --env-file=.env scripts/capturar-telas-guia.ts [matricula]
 */
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SITE = process.env.PORTAL_URL || "https://portal-na-one.vercel.app";
const PASTA = "docs/guias/telas";
const FICTICIO = { nome: "Maria", completo: "Maria Silva" };

async function mascarar(page: Page, nomes: string[]) {
  await page.evaluate(
    ({ nomes, f }) => {
      const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const trocas: [RegExp, string][] = nomes.map((n, i) => [new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), i === 0 ? f.completo : f.nome]);
      for (let n = andar.nextNode(); n; n = andar.nextNode()) {
        let t = n.textContent ?? "";
        for (const [re, por] of trocas) t = t.replace(re, por);
        n.textContent = t;
      }
    },
    { nomes, f: FICTICIO },
  );
}

async function main() {
  const matricula = process.argv[2] ?? "21596";
  const m = await db.member.findFirstOrThrow({ where: { mercurioId: matricula }, select: { email: true, name: true } });
  if (!m.email) throw new Error("Cadastro sem e-mail.");
  const nomes = [m.name, ...m.name.split(/\s+/).filter((p) => p.length > 3)];

  const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: m.email });
  if (link.error) throw link.error;
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  if (error || !data.session) throw error ?? new Error("Sem sessão.");

  // Cookie no formato do @supabase/ssr (base64, em pedaços de 3180).
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const valor = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const pedacos = valor.match(/.{1,3180}/g)!;
  const host = new URL(SITE).hostname;
  const cookies = pedacos.length === 1
    ? [{ name: `sb-${ref}-auth-token`, value: valor, domain: host, path: "/", secure: true, sameSite: "Lax" as const }]
    : pedacos.map((v, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: v, domain: host, path: "/", secure: true, sameSite: "Lax" as const }));

  mkdirSync(PASTA, { recursive: true });
  const browser = await chromium.launch();
  const opcoes = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "pt-BR", colorScheme: "light" as const };

  // 1) Tela de entrada (sem sessão) e 2) login Nova Acrópole.
  const anonimo = await browser.newContext(opcoes);
  const p1 = await anonimo.newPage();
  await p1.goto(`${SITE}/login`, { waitUntil: "networkidle" });
  await p1.screenshot({ path: `${PASTA}/01-entrar.png` });
  await p1.getByText("Entrar com a conta Nova Acrópole").first().click();
  await p1.waitForLoadState("networkidle");
  await p1.waitForTimeout(1500);
  await p1.screenshot({ path: `${PASTA}/02-login-acropole.png` });
  await anonimo.close();

  // 3) Tela inicial e 4) painel de pagamento, logado.
  const ctx = await browser.newContext(opcoes);
  await ctx.addCookies(cookies);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("na-install-prompt-dispensado", "1");
      localStorage.setItem("na-onboarding-visto", "1");
    } catch {}
  });
  // Salvaguarda: nenhuma ação do servidor (POST) sai desta sessão — nada é gerado no Asaas nem gravado.
  await ctx.route("**/*", (r) => (r.request().method() === "POST" ? r.abort() : r.continue()));
  const p = await ctx.newPage();
  await p.goto(`${SITE}/portal`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  await mascarar(p, nomes);
  await p.screenshot({ path: `${PASTA}/03-inicio.png` });
  const pagar = p.getByText(/Pagar agora/).first();
  if (await pagar.count()) {
    await pagar.click();
    await p.waitForTimeout(2000);
    await mascarar(p, nomes);
    await p.screenshot({ path: `${PASTA}/04-pagamento.png` });
  } else console.log("Sem 'Pagar agora' nesta conta (nada em aberto ou pagamento não liberado).");
  await ctx.close();
  await browser.close();

  // Encerra a sessão aberta para a captura.
  await supabaseAdmin.auth.admin.signOut(data.session.access_token).catch(() => null);
  console.log("Telas em", PASTA);
  process.exit(0);
}
main();
