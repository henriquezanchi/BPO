import { avancarSincronizacao } from "@/lib/mercurio-db/rotina-diaria";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";

/**
 * Sincronização diária do Mercúrio em lotes (vercel.json, de hora em hora; ver mercurio-db/rotina-diaria.ts).
 * Cada filial do Portal é atualizada uma vez por dia; quem saiu da escola deixa de ser ativo no fechamento.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const r = await executarRotina("mercurio", { sincronizacao: () => avancarSincronizacao() });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
