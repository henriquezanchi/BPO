import { db } from "@/lib/db";
import { atualizarResumos } from "@/lib/mercurio-db/atualizar-resumos";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";

/**
 * Resumos do Mercúrio para a Visão geral (vercel.json, a cada 15 minutos): cada rodada atualiza os mais
 * antigos (ver atualizar-resumos.ts); em algumas horas todas as unidades da OINAB-N ficam com menos de 20 h.
 * A Vercel chama com "Authorization: Bearer $CRON_SECRET".
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Quedas curtas do banco de consulta (28 e 29/10/2026, voltou sozinho na rodada seguinte) não afetam ninguém:
// os resumos valem 20 h. Só vira erro (saúde + suporte) se o banco ficar sem responder por mais de 1 h.
const CHAVE_FORA = "mercurio-fora:resumos";
const TOLERANCIA_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const r = await executarRotina("resumos", {
    resumos: async () => {
      const resultado = await atualizarResumos(4);
      if (resultado.semConexao) {
        const fora = (await db.resumoNacional.findUnique({ where: { chave: CHAVE_FORA } })) ?? (await db.resumoNacional.create({ data: { chave: CHAVE_FORA, dados: {} } }));
        if (Date.now() - fora.geradoEm.getTime() < TOLERANCIA_MS) return { ...resultado, aguardando: "banco de consulta sem resposta; tenta na próxima rodada" };
        const desde = fora.geradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
        throw new Error(`Banco de consulta do Mercúrio sem resposta desde ${desde} — ${resultado.falhas.join("; ")}`);
      }
      await db.resumoNacional.deleteMany({ where: { chave: CHAVE_FORA } });
      // Falha de uma unidade não para as outras, mas precisa aparecer na saúde e chegar ao suporte.
      if (resultado.falhas?.length) throw new Error(`Resumos com erro: ${resultado.falhas.join("; ")}`);
      return resultado;
    },
  });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
