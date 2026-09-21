// ⚠️ Este arquivo é importado por Server Actions que rodam no site (Vercel,
// serverless) — NÃO importe nada de browser-session.ts/playwright-adapter.ts/
// mercurio/index.ts aqui, nem transitivamente (ex: RodadaEmAndamentoError
// vem de ./errors, não de ./browser-session, de propósito). Isso puxaria o
// pacote "playwright" inteiro pro bundle da action e quebraria em runtime
// com "Cannot find module .../playwright-core/browsers.json" (bug real
// encontrado ao vivo em 2026-09-21 — ver sync-worker.ts, que tem essa mesma
// trava documentada e SÓ pode ser importado pelo worker do Railway).
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { MercurioContactChanges, MercurioPersonalChanges } from "./adapter";

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

/** Enfileira a inclusão de um item de composição escolhido pelo membro (catálogo escolar já sincronizado — ver sync-composition.ts), já com o valor que o membro escolheu. */
export async function enqueueMercurioCompositionAdd(memberId: string, mercurioGroupId: string, label: string, valor: number) {
  return db.mercurioSyncTask.create({
    data: { memberId, taskType: "incluir_item_composicao", payload: { mercurioGroupId, label, valor } },
  });
}

/** Enfileira a exclusão de um item de composição incluído pelo próprio membro pelo Portal. */
export async function enqueueMercurioCompositionRemove(memberId: string, mercurioGroupId: string) {
  return db.mercurioSyncTask.create({
    data: { memberId, taskType: "excluir_item_composicao", payload: { mercurioGroupId } },
  });
}

/** Enfileira a alteração do valor de um item de composição incluído pelo próprio membro pelo Portal. */
export async function enqueueMercurioCompositionEdit(memberId: string, mercurioGroupId: string, novoValor: number) {
  return db.mercurioSyncTask.create({
    data: { memberId, taskType: "editar_valor_item_composicao", payload: { mercurioGroupId, novoValor } },
  });
}

/** Enfileira a atualização das "Anotações Econômicas sobre o Aluno" (textarea txtobs na tela de Composição, ver browser-session.ts). */
export async function enqueueMercurioEconomicNotesUpdate(memberId: string, texto: string) {
  return db.mercurioSyncTask.create({
    data: { memberId, taskType: "atualizar_anotacoes_economicas", payload: { texto } },
  });
}

/** Enfileira a busca do conteúdo (documento) de um recibo específico, sob demanda — ver ContributionReceipt.rawText. */
export async function enqueueMercurioReceiptFetch(memberId: string, mercurioRecId: string) {
  return db.mercurioSyncTask.create({
    data: { memberId, taskType: "buscar_recibo", payload: { mercurioRecId } },
  });
}

/** Enfileira o lançamento de uma contribuição já confirmada pelo Asaas — ver confirmarPagamento() em src/lib/asaas/confirm-payment.ts. */
export async function enqueueMercurioContributionLaunch(memberId: string, chargeId: string) {
  return db.mercurioSyncTask.create({
    data: { memberId, taskType: "lancar_contribuicao_paga", payload: { chargeId } },
  });
}
