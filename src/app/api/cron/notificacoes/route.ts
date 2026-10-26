import { processarListaDeEspera } from "@/lib/event-waitlist";
import { avisosDeAtendimentos, avisosDePlanosDeAula, avisosDeEncontros, avisosDeEventosInscritos, avisosDeEventosNovos, avisosDePedidosNovos, avisosDeVencimento, resumoDaSemana } from "@/lib/notificacoes-agendadas";
import { pushConfigurado } from "@/lib/push";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";

/**
 * Avisos push agendados (vercel.json, a cada 5 minutos): encontros dos grupos, atendimentos, planos de aula, pedidos
 * novos para a Escolástica e a Economia, evento novo, resumo da semana, vencimento da contribuição, avisos de quem se
 * inscreveu em evento. A lista de espera roda sempre; os avisos só com as chaves VAPID (antes, sem elas, a rota parava
 * logo no início e deixava de rodar o que não era push). A conferência das matrículas foi para /api/cron/financeiro.
 */
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const avisos: Record<string, () => Promise<unknown>> = pushConfigurado()
    ? {
        encontros: avisosDeEncontros,
        atendimentos: avisosDeAtendimentos,
        planosDeAula: avisosDePlanosDeAula,
        pedidos: avisosDePedidosNovos,
        eventos: () => avisosDeEventosNovos(),
        semana: () => resumoDaSemana(),
        vencimento: avisosDeVencimento,
        inscritos: avisosDeEventosInscritos,
      }
    : { push: async () => ({ aviso: "Chaves VAPID não configuradas; avisos no celular não enviados." }) };
  const r = await executarRotina("notificacoes", { ...avisos, listaDeEspera: () => processarListaDeEspera() });
  return Response.json(r);
}
