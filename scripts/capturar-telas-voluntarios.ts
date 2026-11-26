/**
 * Captura telas REAIS do Portal em produção para o vídeo do passo a passo dos VOLUNTÁRIOS (25/11/2026). Mesmo método de
 * scripts/capturar-telas-guia.ts: sessão aberta pelo servidor (link mágico + verifyOtp) na conta do dono do sistema,
 * nome trocado por um fictício antes de cada captura, POST bloqueado (nada é gravado nem cobrado), sessão encerrada no
 * fim. Saída: docs/guias/telas-tutorial/*.png (390×844 em escala 3, só a área visível, como um celular).
 * Uso: npx tsx --env-file=.env scripts/capturar-telas-voluntarios.ts
 */
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SITE = process.env.PORTAL_URL || "https://portal-na-one.vercel.app";
const PASTA = "docs/guias/telas-voluntarios";
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
      // Matrícula, telefone, e-mail, endereço, apelido e foto: tudo fictício (o vídeo circula).
      document.querySelectorAll("*").forEach((el) => {
        if (el.children.length) return;
        const t = el.textContent?.trim() ?? "";
        if (/^#?\d{5}$/.test(t)) el.textContent = t.startsWith("#") ? "#12345" : "12345";
        else if (/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(t)) el.textContent = "62 99999-0000";
        else if (/\S+@\S+\.\S+/.test(t)) el.textContent = "maria.silva@email.com";
        else if (/CEP/.test(t) && t.length > 20) el.textContent = "Rua das Flores, 100 · Centro · Goiânia - GO · CEP 74000-000";
      });
      document.querySelectorAll("input").forEach((i) => { if (i.value && /zanchi/i.test(i.value)) i.value = "Maria"; });
      document.querySelectorAll("img").forEach((img) => { if (/member-avatars|avatar/i.test(img.src)) { img.style.visibility = "hidden"; } });
      // QR da carteirinha: borrado (é o código pessoal).
      document.querySelectorAll("svg, canvas").forEach((q) => { const r = q.getBoundingClientRect(); if (r.width > 120 && r.height > 120 && Math.abs(r.width - r.height) < 8) (q as HTMLElement).style.filter = "blur(6px)"; });
    },
    { nomes, f: FICTICIO },
  );
}

const ESCONDER = "nextjs-portal{display:none!important} [data-aviso-app],[data-install-prompt]{display:none!important}";

async function foto(p: Page, nome: string, nomes: string[]) {
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: ESCONDER }).catch(() => null);
  await mascarar(p, nomes);
  await p.screenshot({ path: `${PASTA}/${nome}.png` });
  console.log("ok", nome);
}

async function main() {
  const m = await db.member.findFirstOrThrow({ where: { mercurioId: "21596" }, select: { email: true, name: true } });
  if (!m.email) throw new Error("Cadastro sem e-mail.");
  const nomes = [m.name, ...m.name.split(/\s+/).filter((p) => p.length > 3)];

  const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: m.email });
  if (link.error) throw link.error;
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  if (error || !data.session) throw error ?? new Error("Sem sessão.");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const valor = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const pedacos = valor.match(/.{1,3180}/g)!;
  const host = new URL(SITE).hostname;
  const cookies = pedacos.length === 1
    ? [{ name: `sb-${ref}-auth-token`, value: valor, domain: host, path: "/", secure: SITE.startsWith("https"), sameSite: "Lax" as const }]
    : pedacos.map((v, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: v, domain: host, path: "/", secure: SITE.startsWith("https"), sameSite: "Lax" as const }));

  mkdirSync(PASTA, { recursive: true });
  const browser = await chromium.launch();
  const opcoes = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "pt-BR", colorScheme: "light" as const };

  // Logado, só leitura: Área do Voluntário e as telas de trabalho.
  const ctx = await browser.newContext(opcoes);
  await ctx.addCookies(cookies);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("na-install-prompt-dispensado", "1");
      localStorage.setItem("na-onboarding-visto", "1");
      localStorage.setItem("na-notificacoes-resposta", "depois:9999999999999");
    } catch {}
  });
  await ctx.route("**/*", (r) => (r.request().method() === "POST" ? r.abort() : r.continue()));
  const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  const pagina = async (rota: string, nome: string) => {
    await p.goto(`${SITE}${rota}`, { waitUntil: "load" });
    await p.waitForTimeout(1500);
    await p.addStyleTag({ content: ".fixed.inset-0.z-50{display:none!important}" }).catch(() => null);
    await foto(p, nome, nomes);
  };
  await pagina("/portal", "01-inicio-aluno");
  await pagina("/voluntario", "02-voluntario");
  await pagina("/grupos", "03-grupos");
  await pagina("/voluntario/calendario", "04-calendario");
  await pagina("/voluntario/oportunidades", "05-oportunidades");
  await pagina("/secretarias", "06-secretarias");
  await pagina("/voluntario/eventos", "07-eventos");
  await pagina("/voluntario/cafe", "08-cafe");
  await pagina("/voluntario/trajetoria", "09-trajetoria");
  await pagina("/voluntario/termo", "10-termo");

  await ctx.close();
  await browser.close();
  await supabaseAdmin.auth.admin.signOut(data.session.access_token).catch(() => null);
  console.log("Telas em", PASTA);
  process.exit(0);
}
main();
