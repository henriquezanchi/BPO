import { sincronizarEventosUlisses } from "@/lib/ulisses/publico";
import crypto from "node:crypto";

/**
 * Importação diária dos eventos públicos do Ulisses (agendada em vercel.json).
 * A Vercel chama com "Authorization: Bearer $CRON_SECRET"; sem o segredo
 * configurado, a rota fica fechada.
 */
export const maxDuration = 300;

function autorizado(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  // Diagnóstico temporário (19/10/2026): repete variações para separar padrão de acaso no bloqueio do Cloudflare.
  if (new URL(req.url).searchParams.get("diagnostico") === "1") {
    const ua = "PortalNovaAcropole/1.0 (eventos publicos)";
    const variacoes: [string, Record<string, string>][] = [
      ["maiusculo", { accept: "application/json", "user-agent": ua, "X-Portal-NA": "bypass" }],
      ["minusculo", { accept: "application/json", "user-agent": ua, "x-portal-na": "bypass" }],
      ["sem", { accept: "application/json", "user-agent": ua }],
    ];
    const linhas: string[] = [];
    for (let rodada = 0; rodada < 5; rodada++)
      for (const [nome, h] of variacoes) {
        const r = await fetch(`https://api.acropolebrasil.com.br/eventos/${rodada % 2 ? 16 : 44}`, { headers: h, cache: "no-store" });
        linhas.push(`${rodada}:${nome}:${r.status}`);
      }
    return Response.json({ linhas });
  }
  const resultado = await sincronizarEventosUlisses();
  const falhas = resultado.escolas.filter((e) => e.erro).length;
  console.log(JSON.stringify({ ulisses: resultado }));
  return Response.json(resultado, { status: falhas && falhas === resultado.escolas.length ? 502 : 200 });
}
