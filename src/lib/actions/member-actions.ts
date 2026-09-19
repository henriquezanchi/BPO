"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioContactUpdate } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

export interface ContactChangeInput {
  whatsapp?: string;
  email?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

const CAMPOS_EDITAVEIS = [
  "whatsapp",
  "email",
  "addressStreet",
  "addressNumber",
  "addressComplement",
  "addressNeighborhood",
  "addressCity",
  "addressState",
  "addressZip",
] as const;

const OVERDUE_STATUSES = new Set(["atrasado", "negociando"]);

/**
 * Atualiza os dados de contato do membro a partir do Portal.
 *
 * Regra de negócio: se o membro estiver com contribuição em atraso no
 * momento da alteração, gera um alerta para a secretaria de economia com o
 * antes/depois dos dados — pedido explícito para evitar que inadimplentes
 * troquem contato "por baixo do pano" sem a economia perceber.
 *
 * Também propaga a mudança pro Mercúrio (fonte de verdade cadastral da
 * escola): só enfileira em MercurioSyncTask (histórico/retry) — quem
 * processa de fato é o worker separado (scripts/process-mercurio-queue.ts,
 * agendado via Task Scheduler), NÃO esta Server Action. Antes disso
 * processava a fila na hora (segurava a resposta HTTP pelos ~5-10s de uma
 * sessão de navegador inteira — bug real relatado pelo usuário: "cadastro
 * está bem lento"). O aluno não vê mais confirmação imediata; ver aviso de
 * "até 24h" na UI (profile-edit-panel.tsx).
 *
 * requireAuthenticatedMember confere que quem está logado É o memberId
 * recebido — Server Actions não passam pelo matcher do proxy.ts, então sem
 * isso qualquer um poderia chamar a action com o id de outra pessoa.
 */
export async function updateMemberContact(memberId: string, changes: ContactChangeInput) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  for (const field of CAMPOS_EDITAVEIS) {
    const incoming = changes[field];
    const current = member[field] ?? null;
    if (incoming !== undefined && incoming !== current) {
      oldValues[field] = current;
      newValues[field] = incoming;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { changed: false, alerted: false };
  }

  const wasOverdue = OVERDUE_STATUSES.has(member.status);

  await db.$transaction([
    db.member.update({ where: { id: memberId }, data: newValues }),
    db.contactChangeLog.create({
      data: {
        memberId,
        oldValues,
        newValues,
        memberWasOverdue: wasOverdue,
        alertedEconomia: wasOverdue,
      },
    }),
  ]);

  await enqueueMercurioContactUpdate(memberId, newValues);

  revalidatePath("/portal");

  return { changed: true, alerted: wasOverdue };
}
