/**
 * Worker separado que drena a fila de sincronização com o Mercúrio
 * (MercurioSyncTask) — extraído de dentro das Server Actions (ver
 * member-actions.ts / personal-data-actions.ts / asaas/confirm-payment.ts)
 * pra não segurar a resposta HTTP pelos ~5-10s de uma sessão de navegador
 * (bug real relatado pelo usuário: cadastro lento no Portal).
 *
 * Em produção roda sozinho na rotina /api/cron/fila-mercurio da Vercel (a cada 10 min, desde 26/10/2026); este
 * script é para rodar a fila à mão no computador. A trava scraper_progresso (scraper-credentials.ts) é respeitada
 * via abrirSessaoMercurio.
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
