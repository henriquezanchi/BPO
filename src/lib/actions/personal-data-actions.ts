"use server";

import { db } from "@/lib/db";
import { enqueueMercurioPersonalUpdate, processMercurioSyncQueue } from "@/lib/mercurio/sync-queue";
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
 * Mercúrio via fila processada na hora.
 */
export async function updatePersonalData(memberId: string, changes: PersonalDataInput) {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};
  const newValuesData: Record<string, Date | null> = {};

  for (const field of CAMPOS_TEXTO) {
    const incoming = changes[field];
    const current = member[field] ?? null;
    if (incoming !== undefined && incoming !== current) {
      oldValues[field] = current;
      newValues[field] = incoming;
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
      newValuesData[field] = incoming;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { changed: false, alerted: false, mercurioSynced: false };
  }

  const wasOverdue = OVERDUE_STATUSES.has(member.status);

  // newValues tem tudo como string (pro audit log); pro update de verdade,
  // os campos de data precisam ir como Date/null (newValuesData), não a
  // string ISO usada só pra comparação/log.
  const dbUpdateData: Record<string, string | Date | null> = { ...newValues, ...newValuesData };

  await db.$transaction([
    db.member.update({ where: { id: memberId }, data: dbUpdateData }),
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

  await enqueueMercurioPersonalUpdate(memberId, {
    naturalidade: newValues.naturalidade ?? undefined,
    profession: newValues.profession ?? undefined,
    estadoCivil: newValues.estadoCivil ?? undefined,
    escolaridade: newValues.escolaridade ?? undefined,
    rgNumero: newValues.rgNumero ?? undefined,
    rgOrgaoEmissor: newValues.rgOrgaoEmissor ?? undefined,
    birthDate: "birthDate" in newValuesData ? newValuesData.birthDate : undefined,
    rgDataEmissao: "rgDataEmissao" in newValuesData ? newValuesData.rgDataEmissao : undefined,
  });

  let mercurioSynced = false;
  try {
    const resultados = await processMercurioSyncQueue();
    mercurioSynced = resultados.some((r) => r.memberId === memberId && r.status === "sincronizado");
  } catch (e) {
    console.error("Falha ao processar fila de sincronização com o Mercúrio:", e);
  }

  revalidatePath("/portal");
  revalidatePath("/portal/mais-dados");

  return { changed: true, alerted: wasOverdue, mercurioSynced };
}
