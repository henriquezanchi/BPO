"use server";

import { requireEscolasticaOuDirecao } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Agenda de pendências do Secretário de Escolástica — pedido do usuário
 * 2026-09-30 (caso real: Glaubia Rocha Barbosa Relvas, que precisa ser
 * incluída no Círculo de Amigos numa data futura). Por ora é conclusão
 * MANUAL — ver ScholasticPendency no schema pro motivo de ainda não
 * automatizar a execução no Mercúrio.
 */
export async function getPendenciasEscolastica(schoolId: string) {
  await requireEscolasticaOuDirecao(schoolId);
  return db.scholasticPendency.findMany({
    where: { schoolId },
    include: { member: { select: { id: true, name: true } } },
    orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }],
  });
}

/** Lista leve pro seletor "sobre qual membro" do formulário de nova pendência. */
export async function getMembrosParaPendencia(schoolId: string) {
  await requireEscolasticaOuDirecao(schoolId);
  return db.member.findMany({
    where: { schoolId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function criarPendenciaEscolastica(
  schoolId: string,
  dados: { memberId: string | null; tipo: string; title: string; notes: string; dueDate: string },
) {
  await requireEscolasticaOuDirecao(schoolId);
  if (!dados.title.trim()) throw new Error("Descreva a pendência.");
  if (!dados.dueDate) throw new Error("Informe a data prevista.");

  await db.scholasticPendency.create({
    data: {
      schoolId,
      memberId: dados.memberId || null,
      tipo: dados.tipo || "outro",
      title: dados.title.trim(),
      notes: dados.notes.trim() || null,
      dueDate: new Date(dados.dueDate),
    },
  });
  revalidatePath("/escolastica");
  revalidatePath("/diretor");
}

export async function concluirPendenciaEscolastica(schoolId: string, pendencyId: string) {
  await requireEscolasticaOuDirecao(schoolId);
  const pendencia = await db.scholasticPendency.findUniqueOrThrow({ where: { id: pendencyId } });
  if (pendencia.schoolId !== schoolId) throw new Error("Pendência não pertence a esta escola.");

  await db.scholasticPendency.update({ where: { id: pendencyId }, data: { completedAt: new Date() } });
  revalidatePath("/escolastica");
  revalidatePath("/diretor");
}
