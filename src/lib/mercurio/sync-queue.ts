import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { MercurioContactChanges } from "./adapter";
import { mercurioAdapter } from "./mock-adapter";

/**
 * Enfileira uma atualização de contato para ser propagada ao Mercúrio.
 * Chamado sempre pelo server action de atualização de cadastro, independente
 * de já sabermos processar a fila de verdade — assim nenhuma alteração feita
 * pelo aluno se perde enquanto a integração de escrita não está pronta.
 */
export async function enqueueMercurioContactUpdate(
  memberId: string,
  changes: MercurioContactChanges,
) {
  return db.mercurioSyncTask.create({
    data: {
      memberId,
      taskType: "atualizar_contato",
      payload: changes as Prisma.InputJsonValue,
    },
  });
}

/**
 * Processa tarefas pendentes da fila. Hoje usa o MockMercurioAdapter, então
 * as tarefas são marcadas como sincronizadas sem de fato alterar o Mercúrio.
 * Trocar para o adapter real (API/RPA) aqui é a única mudança necessária
 * quando a integração de escrita for confirmada e implementada.
 *
 * Pensado para rodar via cron (ex: a cada poucos minutos) uma vez que
 * exista um adapter real; hoje pode ser chamado manualmente para depuração.
 */
export async function processMercurioSyncQueue(limit = 20) {
  const pending = await db.mercurioSyncTask.findMany({
    where: { status: "pendente" },
    include: { member: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const task of pending) {
    if (!task.member.mercurioId) {
      results.push(
        await db.mercurioSyncTask.update({
          where: { id: task.id },
          data: {
            status: "falhou",
            attempts: { increment: 1 },
            lastError: "Membro sem mercurioId vinculado — não sabemos qual cadastro atualizar no Mercúrio.",
          },
        }),
      );
      continue;
    }

    const result = await mercurioAdapter.pushContactUpdate(
      task.member.mercurioId,
      task.payload as MercurioContactChanges,
    );

    results.push(
      await db.mercurioSyncTask.update({
        where: { id: task.id },
        data: result.ok
          ? { status: "sincronizado", syncedAt: new Date(), attempts: { increment: 1 } }
          : { status: "falhou", attempts: { increment: 1 }, lastError: result.error ?? "Erro desconhecido" },
      }),
    );
  }

  return results;
}
