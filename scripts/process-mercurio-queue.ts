/**
 * Worker separado que drena a fila de sincronização com o Mercúrio
 * (MercurioSyncTask) — extraído de dentro das Server Actions (ver
 * member-actions.ts / personal-data-actions.ts / asaas/confirm-payment.ts)
 * pra não segurar a resposta HTTP pelos ~5-10s de uma sessão de navegador
 * (bug real relatado pelo usuário: cadastro lento no Portal).
 *
 * Pensado pra rodar periodicamente via Windows Task Scheduler (mesmo
 * padrão externo já usado pelo "scraper agendado" — ver comentário em
 * scraper-credentials.ts sobre a trava scraper_progresso, respeitada
 * automaticamente aqui via abrirSessaoMercurio). Sugestão: a cada 5-10min.
 * Enquanto isso não está agendado, o Portal já avisa o membro que a
 * alteração pode levar até 24h pra ser confirmada no Mercúrio — rodar este
 * script manualmente também resolve a fila na hora.
 *
 * Uso: npx tsx scripts/process-mercurio-queue.ts
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { processMercurioSyncQueue, processSchoolRubricaSyncRequests } from "../src/lib/mercurio/sync-worker";

async function main() {
  const resultados = await processMercurioSyncQueue();
  if (resultados.length === 0) {
    console.log("Fila vazia — nada a processar.");
  } else {
    const porStatus = resultados.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`Processadas ${resultados.length} tarefa(s):`, porStatus);
  }

  const rubricas = await processSchoolRubricaSyncRequests();
  if (rubricas.length > 0) {
    console.log(`Pedidos de sincronização de rubricas processados: ${rubricas.length}`, rubricas);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
