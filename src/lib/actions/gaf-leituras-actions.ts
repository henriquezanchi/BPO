"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { SEM_LEITURA, textoGaf } from "@/lib/gaf-leituras";
import { papelNoGrupo } from "@/lib/grupos-portal";

/**
 * Texto do encontro do GAF escolhido pela coordenação (2026-10-26). `codigo`: texto do cronograma ("teseu-05"),
 * "nenhuma" (sem leitura neste encontro) ou null (volta ao automático, seguindo a sequência).
 */
export async function definirLeituraGaf(meetingId: string, codigo: string | null) {
  const m = await getAuthenticatedMember();
  if (!m?.mercurioAtivo) return { ok: false as const, error: "Entre com uma conta ativa para continuar." };
  if (codigo !== null && codigo !== SEM_LEITURA && !textoGaf(codigo)) return { ok: false as const, error: "Texto não encontrado no cronograma." };
  const encontro = await db.groupMeeting.findUnique({ where: { id: meetingId }, select: { classGroupId: true, classGroup: { select: { tipo: true } } } });
  if (!encontro || encontro.classGroup.tipo !== "GAF") return { ok: false as const, error: "Encontro não encontrado." };
  if (!(await papelNoGrupo(m, encontro.classGroupId)).podeGerir) return { ok: false as const, error: "Só a coordenação do GAF escolhe os textos." };
  await db.groupMeeting.update({ where: { id: meetingId }, data: { leituraGaf: codigo } });
  revalidatePath(`/grupos/${encontro.classGroupId}`);
  return { ok: true as const };
}
