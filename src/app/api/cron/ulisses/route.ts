import { lerCartazesPendentes } from "@/lib/leitura-cartaz";
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
  const resultado = await sincronizarEventosUlisses();
  const falhas = resultado.escolas.filter((e) => e.erro).length;
  // Lê os cartazes novos (uma vez por imagem) para o compartilhamento só acrescentar o que falta.
  const cartazes = await lerCartazesPendentes().catch((e) => ({ erro: String(e) }));
  console.log(JSON.stringify({ ulisses: resultado, cartazes }));
  return Response.json({ ...resultado, cartazes }, { status: falhas && falhas === resultado.escolas.length ? 502 : 200 });
}
