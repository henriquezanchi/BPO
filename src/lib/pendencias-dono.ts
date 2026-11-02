import "server-only";
import { db } from "@/lib/db";
import { avisarDono } from "@/lib/error-notify";
import { Prisma } from "@prisma/client";

/**
 * Lembrete das pendências do dono do sistema (pedido do usuário 01/11/2026: "me cobre periodicamente que eu faça,
 * para eu não esquecer"). Segundas e quintas às 9h de Brasília, pelo WhatsApp de avisos (CallMeBot), só com o que
 * ainda falta. Cada item se confere sozinho e some do lembrete quando resolvido; sem nada pendente, não envia.
 */
const REPOSITORIO = "henriquezanchi/BPO";
// A senha inicial pelo CPF saiu da lista em 02/11/2026: logins novos têm senha aleatória e a volta para o CPF foi retirada.

async function repositorioPublico() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPOSITORIO}`, { headers: { accept: "application/vnd.github+json", "user-agent": "portal-na" }, signal: AbortSignal.timeout(10_000) });
    if (r.status === 404) return false;
    if (!r.ok) return null;
    return ((await r.json()) as { private?: boolean }).private === false;
  } catch {
    return null;
  }
}

export async function pendenciasDoDono() {
  const lista: string[] = [];
  if (await repositorioPublico())
    lista.push("Tornar privado o repositório do Portal no GitHub (Settings → Danger Zone → Change visibility). Hoje qualquer pessoa lê o código e a documentação.");
  if (!process.env.TURNSTILE_SECRET_KEY || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
    lista.push("Proteção contra robôs na matrícula: criar o widget Turnstile no Cloudflare e colocar TURNSTILE_SECRET_KEY e NEXT_PUBLIC_TURNSTILE_SITE_KEY na Vercel.");
  return lista;
}

function agoraEmBrasilia(agora: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(agora).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), diaDaSemana: p.weekday };
}

export async function lembrarPendenciasDoDono(agora = new Date()) {
  const { data, hora, diaDaSemana } = agoraEmBrasilia(agora);
  if (!["Mon", "Thu"].includes(diaDaSemana) || hora !== 9) return "fora do horário do lembrete";
  const lista = await pendenciasDoDono();
  if (!lista.length) return "nada pendente";
  try {
    await db.pushEnviado.create({ data: { chave: `pendencias-dono:${data}` } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "já lembrado hoje";
    throw e;
  }
  await avisarDono(["📌 Pendências suas no Portal NA", ...lista.map((t, i) => `${i + 1}. ${t}`)].join("\n"));
  return `${lista.length} pendência(s) lembrada(s)`;
}
