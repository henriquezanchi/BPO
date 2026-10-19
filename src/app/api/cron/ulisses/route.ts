import { sincronizarEventosUlisses } from "@/lib/ulisses/publico";
import crypto from "node:crypto";

/**
 * Importação diária dos eventos públicos do Ulisses (agendada em vercel.json).
 * A Vercel chama com "Authorization: Bearer $CRON_SECRET"; sem o segredo
 * configurado, a rota fica fechada.
 */
export const maxDuration = 300;
// Roda em São Paulo: o Cloudflare do Ulisses desafia acessos vindos dos EUA (região padrão da Vercel).
export const preferredRegion = "gru1";

function autorizado(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const resultado = await sincronizarEventosUlisses();
  const falhas = resultado.escolas.filter((e) => e.erro).length;
  console.log(JSON.stringify({ ulisses: resultado }));
  return Response.json(resultado, { status: falhas && falhas === resultado.escolas.length ? 502 : 200 });
}
