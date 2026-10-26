import { autorizadoCron, executarRotina } from "@/lib/rotinas";
import { VERIFICACOES } from "@/lib/saude";

/** Verificação de saúde (vercel.json, de hora em hora): serviço fora do ar avisa o suporte pelo WhatsApp. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const r = await executarRotina("saude", Object.fromEntries(Object.entries(VERIFICACOES).map(([k, v]) => [k, v.checar])));
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
