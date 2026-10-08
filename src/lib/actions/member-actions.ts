"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioContactUpdate } from "@/lib/mercurio/sync-queue";
import { revalidatePath } from "next/cache";

export interface AddressChangeInput {
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

export interface SensitiveContactInput {
  whatsapp?: string;
  email?: string;
}

const CAMPOS_ENDERECO = [
  "addressStreet",
  "addressNumber",
  "addressComplement",
  "addressNeighborhood",
  "addressCity",
  "addressState",
  "addressZip",
] as const;

const CAMPOS_SENSIVEIS = ["whatsapp", "email"] as const;

const OVERDUE_STATUSES = new Set(["atrasado", "negociando"]);

/**
 * Atualiza SÓ o endereço do membro — edição direta, igual sempre foi.
 * WhatsApp e e-mail saíram daqui (ver solicitarAlteracaoContato): pedido do
 * usuário 2026-10-08 — são os dois dados de contato realmente sensíveis
 * (usados pra comunicação/identificação), então passam a exigir aprovação
 * do Secretário de Escolástica em vez de edição livre. Endereço é só
 * logística, risco bem menor, continua de autoatendimento.
 *
 * Também propaga a mudança pro Mercúrio: só enfileira em MercurioSyncTask
 * (histórico/retry) — quem processa de fato é o worker separado
 * (scripts/process-mercurio-queue.ts), NÃO esta Server Action (segurava a
 * resposta HTTP pelos ~5-10s de uma sessão de navegador inteira antes).
 *
 * requireAuthenticatedMember confere que quem está logado É o memberId
 * recebido — Server Actions não passam pelo matcher do proxy.ts, então sem
 * isso qualquer um poderia chamar a action com o id de outra pessoa.
 */
export async function updateMemberAddress(memberId: string, changes: AddressChangeInput) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  for (const field of CAMPOS_ENDERECO) {
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
        status: "aplicado",
        memberWasOverdue: wasOverdue,
        alertedEconomia: wasOverdue,
      },
    }),
  ]);

  await enqueueMercurioContactUpdate(memberId, newValues);

  revalidatePath("/portal");

  return { changed: true, alerted: wasOverdue };
}

/**
 * Registra uma SOLICITAÇÃO de correção de WhatsApp/e-mail — não aplica nada
 * em Member ainda. Fica pendente até o Secretário de Escolástica aprovar
 * (ver aprovarSolicitacaoCadastro em escolastica-actions.ts), que só então
 * grava de verdade e enfileira a propagação pro Mercúrio.
 */
export async function solicitarAlteracaoContato(memberId: string, changes: SensitiveContactInput) {
  const member = await requireAuthenticatedMember(memberId);

  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  for (const field of CAMPOS_SENSIVEIS) {
    const incoming = changes[field];
    const current = member[field] ?? null;
    if (incoming !== undefined && incoming.trim() !== "" && incoming !== current) {
      oldValues[field] = current;
      newValues[field] = incoming;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { solicitado: false };
  }

  await db.contactChangeLog.create({
    data: {
      memberId,
      oldValues,
      newValues,
      status: "pendente",
      memberWasOverdue: OVERDUE_STATUSES.has(member.status),
    },
  });

  revalidatePath("/portal");

  return { solicitado: true };
}

/** Pra UI mostrar "você já tem uma solicitação em aberto" e não deixar mandar duplicada. */
export async function getSolicitacaoContatoPendente(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const pendente = await db.contactChangeLog.findFirst({
    where: { memberId, status: "pendente" },
    orderBy: { createdAt: "desc" },
  });
  return pendente ? { oldValues: pendente.oldValues, newValues: pendente.newValues, createdAt: pendente.createdAt } : null;
}
