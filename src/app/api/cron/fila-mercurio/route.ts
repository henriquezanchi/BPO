import { aplicarEspelhoAprovado } from "@/lib/espelho-mercury/aplicar";
import { espelhoLigado } from "@/lib/espelho-mercury/rodar";
import { processMercurioSyncQueue, processSchoolRubricaSyncRequests } from "@/lib/mercurio/sync-worker";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";

/**
 * Fila de escrita no Mercúrio (vercel.json, a cada 10 minutos; 26/10/2026, antes Railway/Agendador do Windows):
 * lançamento de contribuição paga, alterações de cadastro e composição, pedidos de rubricas. Navegador automatizado
 * com o Chromium de servidor; poucas tarefas por vez para caber no tempo. Tarefa que falha fica marcada na fila e
 * avisa o suporte.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const r = await executarRotina("fila-mercurio", {
    tarefas: async () => {
      const resultados = await processMercurioSyncQueue(4);
      const falhas = resultados.filter((x) => x.status === "falhou");
      if (falhas.length) throw new Error(`${falhas.length} de ${resultados.length} tarefa(s) falharam: ${falhas.map((f) => `${f.taskType}: ${f.lastError ?? "sem detalhe"}`).join("; ").slice(0, 300)}`);
      return { processadas: resultados.length };
    },
    rubricas: async () => ({ pedidos: (await processSchoolRubricaSyncRequests()).length }),
    // Espelho Mercury → antigo: itens aprovados (em espera até ESPELHO_MERCURY_LIGADO=1; desligado não consulta nada).
    espelho: async () => {
      if (!espelhoLigado()) return { emEspera: true };
      const feitos = await aplicarEspelhoAprovado(2);
      const erros = feitos.filter((f) => f.status === "erro");
      if (erros.length) throw new Error(`${erros.length} item(ns) do espelho falharam e ficaram para fazer à mão: ${erros.map((e) => e.resumo).join("; ").slice(0, 300)}`);
      return { processados: feitos.length };
    },
  });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
