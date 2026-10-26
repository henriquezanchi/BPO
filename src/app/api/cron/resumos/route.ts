import { atualizarResumos } from "@/lib/mercurio-db/atualizar-resumos";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";

/**
 * Resumos do Mercúrio para a Visão geral (vercel.json, a cada 15 minutos): cada rodada atualiza os mais
 * antigos (ver atualizar-resumos.ts); em algumas horas todas as unidades da OINAB-N ficam com menos de 20 h.
 * A Vercel chama com "Authorization: Bearer $CRON_SECRET".
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const r = await executarRotina("resumos", {
    resumos: async () => {
      const resultado = await atualizarResumos(4);
      // Falha de uma unidade não para as outras, mas precisa aparecer na saúde e chegar ao suporte.
      if (resultado.falhas?.length) throw new Error(`Resumos com erro: ${resultado.falhas.join("; ")}`);
      return resultado;
    },
  });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
