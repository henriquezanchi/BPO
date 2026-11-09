import { avisosDeAniversario } from "@/lib/aniversarios";
import { avisosDeAlunosSumindo, resumoSemanalDaDirecao } from "@/lib/avisos-direcao";
import { lembretesDeAula } from "@/lib/lembrete-aula";
import { avisosDeVoluntariado } from "@/lib/avisos-voluntariado";
import { avisosDeContasAPagar } from "@/lib/avisos-contas";
import { avisosDeChegadaDeInteressados } from "@/lib/aberturas/recepcao-interessados";
import { processarListaDeEspera } from "@/lib/event-waitlist";
import { avisosDeAtendimentos, avisosDoDiario, avisosDoDiarioFv, avisosDePlanosDeAula, avisosDeEncontros, avisosDeEventosInscritos, avisosDeEventosNovos, avisosDePedidosNovos, avisosDeVencimento, resumoDaSemana } from "@/lib/notificacoes-agendadas";
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
        diario: () => avisosDoDiario(),
        // Diário de FV (2026-10-31): práticas paradas há 3 dias e reunião do GDVE em 7 dias, às 20h da filial.
        diarioFv: () => avisosDoDiarioFv(),
        // Aniversários (06/11/2026): parabéns em nome da Nova Acrópole, aviso à turma e aniversário de casa, às 8h da filial.
        aniversarios: () => avisosDeAniversario(),
        // 06/11/2026: lembrete da aula (3 h antes, com a sala), resumo da semana para a direção (segunda, 8h) e alunos
        // sem contribuição há 60 dias viram pendência da Escolástica (segunda, 9h).
        aulas: () => lembretesDeAula(),
        semanaDirecao: () => resumoSemanalDaDirecao(),
        alunosSumindo: () => avisosDeAlunosSumindo(),
        // 07/11/2026: voluntariado da semana (segunda, 10h) e lembrete na véspera (18h) para quem foi aceito.
        voluntariado: () => avisosDeVoluntariado(),
        // 07/11/2026: no dia da primeira aula de uma abertura, quem são os interessados esperados.
        chegadaInteressados: () => avisosDeChegadaDeInteressados(),
        // 09/11/2026: contas a pagar da Economia, na véspera e no dia do vencimento, às 8h da filial.
        contasAPagar: () => avisosDeContasAPagar(),
      }
    : { push: async () => ({ aviso: "Chaves VAPID não configuradas; avisos no celular não enviados." }) };
  const r = await executarRotina("notificacoes", { ...avisos, listaDeEspera: () => processarListaDeEspera() });
  return Response.json(r);
}
