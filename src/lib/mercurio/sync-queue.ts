import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { MercurioContactChanges, MercurioPersonalChanges } from "./adapter";
import { mercurioAdapter } from "./index";

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

// Datas não são um tipo JSON válido — serializa pra ISO string (ou null)
// antes de gravar na fila, e desserializa de volta na hora de processar.
type MercurioPersonalChangesJson = Omit<MercurioPersonalChanges, "birthDate" | "rgDataEmissao"> & {
  birthDate?: string | null;
  rgDataEmissao?: string | null;
};

/** Enfileira uma atualização de "Mais Dados" (RG, nascimento, profissão...) pra propagação ao Mercúrio. */
export async function enqueueMercurioPersonalUpdate(memberId: string, changes: MercurioPersonalChanges) {
  const payload: MercurioPersonalChangesJson = {
    ...changes,
    birthDate: changes.birthDate === undefined ? undefined : changes.birthDate?.toISOString() ?? null,
    rgDataEmissao: changes.rgDataEmissao === undefined ? undefined : changes.rgDataEmissao?.toISOString() ?? null,
  };
  return db.mercurioSyncTask.create({
    data: {
      memberId,
      taskType: "atualizar_dados_pessoais",
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

/**
 * Processa tarefas pendentes da fila, escrevendo de verdade no Mercúrio
 * (mercurioAdapter é o real quando as credenciais estão configuradas — ver
 * mercurio/index.ts). Chamada hoje síncrona, ao fim de updateMemberContact/
 * updatePersonalData — aceitável na escala do MVP (1 filial, poucas
 * edições), mas deve virar um worker/cron separado antes de produção com
 * mais filiais, pra:
 *   (a) não segurar a resposta HTTP pelos ~5-10s de uma sessão de navegador,
 *   (b) coordenar direito com o scraper agendado via a MESMA trava
 *       (scraper_progresso — já respeitada aqui, ver abrirSessaoMercurio).
 */
export async function processMercurioSyncQueue(limit = 20) {
  const pending = await db.mercurioSyncTask.findMany({
    where: { status: "pendente" },
    include: { member: { include: { school: true } } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const task of pending) {
    const { member } = task;
    if (!member.mercurioId || !member.school.mercurioFilialLabel) {
      results.push(
        await db.mercurioSyncTask.update({
          where: { id: task.id },
          data: {
            status: "falhou",
            attempts: { increment: 1 },
            lastError: !member.mercurioId
              ? "Membro sem mercurioId (matrícula) vinculado — não sabemos qual cadastro atualizar no Mercúrio."
              : "Escola sem mercurioFilialLabel configurado — não sabemos qual filial navegar no Mercúrio.",
          },
        }),
      );
      continue;
    }

    const identidade = { matricula: member.mercurioId, name: member.name, filialLabel: member.school.mercurioFilialLabel };

    let result;
    if (task.taskType === "atualizar_dados_pessoais") {
      const payload = task.payload as MercurioPersonalChangesJson;
      result = await mercurioAdapter.pushPersonalUpdate(identidade, {
        ...payload,
        birthDate: payload.birthDate === undefined ? undefined : payload.birthDate ? new Date(payload.birthDate) : null,
        rgDataEmissao: payload.rgDataEmissao === undefined ? undefined : payload.rgDataEmissao ? new Date(payload.rgDataEmissao) : null,
      });
    } else {
      result = await mercurioAdapter.pushContactUpdate(identidade, task.payload as MercurioContactChanges);
    }

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
