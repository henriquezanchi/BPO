"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface PersonalDataInput {
  birthDate?: string; // "YYYY-MM-DD" (input type=date) ou "" pra limpar
  naturalidade?: string;
  profession?: string;
  estadoCivil?: string;
  escolaridade?: string;
  rgNumero?: string;
  rgOrgaoEmissor?: string;
  rgDataEmissao?: string;
}

const CAMPOS_TEXTO = ["naturalidade", "profession", "estadoCivil", "escolaridade", "rgNumero", "rgOrgaoEmissor"] as const;
const CAMPOS_DATA = ["birthDate", "rgDataEmissao"] as const;

function parseDataInput(v: string | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === "") return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const OVERDUE_STATUSES = new Set(["atrasado", "negociando"]);

/**
 * Atualiza "Mais Dados" (RG, nascimento, profissão, naturalidade,
 * escolaridade, estado civil) a partir do Portal — mesmo padrão de
 * updateMemberContact (src/lib/actions/member-actions.ts): audit log com
 * alerta pra economia se o membro estiver em atraso, e propagação pro
 * Mercúrio só enfileirada aqui — processada em background pelo worker
 * separado (scripts/process-mercurio-queue.ts), não nesta Server Action.
 */
export async function updatePersonalData(memberId: string, changes: PersonalDataInput) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  for (const field of CAMPOS_TEXTO) {
    const incoming = changes[field];
    const current = member[field] ?? null;
    if (incoming !== undefined && (incoming || null) !== current) {
      oldValues[field] = current;
      newValues[field] = incoming || null;
    }
  }

  for (const field of CAMPOS_DATA) {
    const incoming = parseDataInput(changes[field]);
    if (incoming === undefined) continue;
    const current = member[field] ?? null;
    const currentIso = current ? current.toISOString().slice(0, 10) : null;
    const incomingIso = incoming ? incoming.toISOString().slice(0, 10) : null;
    if (incomingIso !== currentIso) {
      oldValues[field] = currentIso;
      newValues[field] = incomingIso;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { changed: false, alerted: false };
  }

  const wasOverdue = OVERDUE_STATUSES.has(member.status);

  // Pedido do usuário 2026-10-19: vira SOLICITAÇÃO pendente — nada muda no
  // Portal nem no Mercúrio até a Escolástica/Direção aprovar (ver
  // aprovarSolicitacaoCadastro). Datas ficam como "AAAA-MM-DD" no registro.
  await db.contactChangeLog.create({
    data: { memberId, oldValues, newValues, status: "pendente", memberWasOverdue: wasOverdue, alertedEconomia: wasOverdue },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/mais-dados");
  return { changed: true, alerted: wasOverdue, pendente: true };
}
