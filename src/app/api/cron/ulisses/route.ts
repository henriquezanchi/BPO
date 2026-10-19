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
  // Diagnóstico temporário (19/10/2026): prova que o cabeçalho sai do servidor e testa variações contra o Cloudflare.
  if (new URL(req.url).searchParams.get("diagnostico") === "1") {
    const alvo = "https://api.acropolebrasil.com.br/eventos/44";
    const variacoes: [string, Record<string, string>][] = [
      ["atual", { accept: "application/json", "user-agent": "PortalNovaAcropole/1.0 (eventos publicos)", "X-Portal-NA": "bypass" }],
      ["minusculo", { accept: "application/json", "user-agent": "PortalNovaAcropole/1.0 (eventos publicos)", "x-portal-na": "bypass" }],
      ["navegador", { accept: "application/json", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36", "X-Portal-NA": "bypass" }],
      ["sem-cabecalho", { accept: "application/json" }],
    ];
    const eco = await fetch("https://httpbin.org/headers", { headers: variacoes[0][1] }).then((r) => r.json()).catch((e) => ({ erro: String(e) }));
    const testes = [];
    for (const [nome, h] of variacoes) {
      const r = await fetch(alvo, { headers: h, cache: "no-store" });
      testes.push({ nome, status: r.status, ray: r.headers.get("cf-ray"), mitigado: r.headers.get("cf-mitigated") });
    }
    return Response.json({ eco, testes });
  }
  const resultado = await sincronizarEventosUlisses();
  const falhas = resultado.escolas.filter((e) => e.erro).length;
  console.log(JSON.stringify({ ulisses: resultado }));
  return Response.json(resultado, { status: falhas && falhas === resultado.escolas.length ? 502 : 200 });
}
