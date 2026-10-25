import { atualizarResumos } from "@/lib/mercurio-db/atualizar-resumos";
import { timingSafeEqual } from "node:crypto";

/**
 * Resumos do Mercúrio para a Visão geral (vercel.json, a cada 15 minutos): cada rodada atualiza os mais
 * antigos (ver atualizar-resumos.ts); em algumas horas todas as unidades da OINAB-N ficam com menos de 20 h.
 * A Vercel chama com "Authorization: Bearer $CRON_SECRET".
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  if (!segredo || recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const resultado = await atualizarResumos(4);
  console.log(JSON.stringify({ resumos: resultado }));
  return Response.json(resultado, { headers: { "Cache-Control": "no-store" } });
}
