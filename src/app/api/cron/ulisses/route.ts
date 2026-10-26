import { lerCartazesPendentes } from "@/lib/leitura-cartaz";
import { gerarResumosTela } from "@/lib/resumo-tela";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";
import { sincronizarEventosUlisses } from "@/lib/ulisses/publico";

/**
 * Importação diária dos eventos públicos do Ulisses (agendada em vercel.json).
 * A Vercel chama com "Authorization: Bearer $CRON_SECRET"; sem o segredo
 * configurado, a rota fica fechada. Filial com erro conta como falha da rotina (aviso ao suporte).
 */
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  let todasFalharam = false;
  const r = await executarRotina("ulisses", {
    eventos: async () => {
      const resultado = await sincronizarEventosUlisses();
      const falhas = resultado.escolas.filter((e) => e.erro);
      todasFalharam = falhas.length > 0 && falhas.length === resultado.escolas.length;
      if (falhas.length) throw new Error(`${falhas.length} de ${resultado.escolas.length} filiais com erro: ${falhas.map((e) => `${e.escola} (${e.erro})`).join("; ")}`);
      return resultado;
    },
    // Lê os cartazes novos (uma vez por imagem) para o compartilhamento só acrescentar o que falta.
    cartazes: () => lerCartazesPendentes(),
    // Resume as descrições novas para as telas de TV (uma vez por descrição).
    resumosTela: () => gerarResumosTela(),
  });
  return Response.json(r, { status: todasFalharam ? 502 : 200 });
}
