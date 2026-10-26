import { confirmarContribuicoesPendentes, criarCicloPixAutomatico } from "@/lib/asaas/pix-automatico-ciclo";
import { conferirRecargasPendentes } from "@/lib/fortuna/confirmar-recarga";
import { conferirMatriculasPendentes } from "@/lib/matricula-online";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";

/**
 * Rotina financeira (vercel.json, a cada 10 minutos; 26/10/2026, substitui o Railway): confere no Asaas as cobranças
 * pendentes cujo aviso de pagamento não chegou (contribuições, recargas do Fortuna, matrículas pelo site) e cria o
 * ciclo do Pix Automático na janela do Asaas. Sem filial com subconta ligada, só confere e não cria nada.
 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const r = await executarRotina("financeiro", {
    contribuicoes: confirmarContribuicoesPendentes,
    recargasFortuna: conferirRecargasPendentes,
    matriculas: () => conferirMatriculasPendentes(),
    pixAutomatico: criarCicloPixAutomatico,
  });
  return Response.json(r);
}
