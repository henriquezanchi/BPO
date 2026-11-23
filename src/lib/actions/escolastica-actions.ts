"use server";

import { requireEscolasticaOuDirecao } from "@/lib/auth";
import { db } from "@/lib/db";
import { avisarSemEsperar } from "@/lib/push";
import { aplicarAlteracaoCadastro } from "@/lib/cadastro-aplicar";
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
  // A pessoa ligada à pendência é da mesma filial (01/11/2026).
  if (dados.memberId && !(await db.member.count({ where: { id: dados.memberId, schoolId } }))) throw new Error("Pessoa não encontrada nesta filial.");

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
  revalidatePath("/", "layout");
}

export async function concluirPendenciaEscolastica(schoolId: string, pendencyId: string) {
  await requireEscolasticaOuDirecao(schoolId);
  const pendencia = await db.scholasticPendency.findUniqueOrThrow({ where: { id: pendencyId } });
  if (pendencia.schoolId !== schoolId) throw new Error("Pendência não pertence a esta escola.");

  await db.scholasticPendency.update({ where: { id: pendencyId }, data: { completedAt: new Date() } });
  revalidatePath("/escolastica");
  revalidatePath("/", "layout");
}

/**
 * Solicitações de correção de WhatsApp/e-mail (campos sensíveis — ver
 * solicitarAlteracaoContato em member-actions.ts) pendentes de aprovação.
 */
export async function getSolicitacoesCadastroPendentes(schoolId: string) {
  await requireEscolasticaOuDirecao(schoolId);
  return db.contactChangeLog.findMany({
    where: { status: "pendente", member: { schoolId } },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Aprova: aplica de verdade em Member e enfileira a propagação pro Mercúrio. */
export async function aprovarSolicitacaoCadastro(schoolId: string, logId: string) {
  await requireEscolasticaOuDirecao(schoolId);
  const log = await db.contactChangeLog.findUniqueOrThrow({ where: { id: logId }, include: { member: true } });
  if (log.member.schoolId !== schoolId) throw new Error("Solicitação não pertence a esta escola.");
  if (log.status !== "pendente") throw new Error("Solicitação já foi revisada.");

  await aplicarAlteracaoCadastro(logId);

  await avisarSemEsperar([log.memberId], { titulo: "Cadastro atualizado", corpo: "A secretaria aprovou a alteração dos seus dados.", url: "/portal", etiqueta: `cadastro-${logId}` });
  revalidatePath("/escolastica");
  revalidatePath("/portal");
}

/** Rejeita: nada é aplicado, só marca como revisado. */
export async function rejeitarSolicitacaoCadastro(schoolId: string, logId: string) {
  await requireEscolasticaOuDirecao(schoolId);
  const log = await db.contactChangeLog.findUniqueOrThrow({ where: { id: logId }, include: { member: true } });
  if (log.member.schoolId !== schoolId) throw new Error("Solicitação não pertence a esta escola.");
  if (log.status !== "pendente") throw new Error("Solicitação já foi revisada.");

  await db.contactChangeLog.update({ where: { id: logId }, data: { status: "rejeitado", reviewedAt: new Date() } });
  await avisarSemEsperar([log.memberId], { titulo: "Alteração de cadastro não aprovada", corpo: "A secretaria não aprovou a alteração dos seus dados. Em caso de dúvida, fale com a Escolástica.", url: "/portal", etiqueta: `cadastro-${logId}` });
  revalidatePath("/escolastica");
}
