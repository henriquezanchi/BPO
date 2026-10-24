import { lerCartazesPendentes } from "@/lib/leitura-cartaz";
import { gerarResumosTela } from "@/lib/resumo-tela";
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
  // Resume as descrições novas para as telas de TV (uma vez por descrição).
  const resumosTela = await gerarResumosTela().catch((e) => ({ erro: String(e) }));
  console.log(JSON.stringify({ ulisses: resultado, cartazes, resumosTela }));
  return Response.json({ ...resultado, cartazes, resumosTela }, { status: falhas && falhas === resultado.escolas.length ? 502 : 200 });
}
