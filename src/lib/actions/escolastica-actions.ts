"use server";

import { requireEscolasticaOuDirecao } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueMercurioContactUpdate, enqueueMercurioPersonalUpdate } from "@/lib/mercurio/sync-queue";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Campos de "Mais Dados" (ver personal-data-actions.ts) — o resto de uma
// solicitação é contato/endereço.
const CAMPOS_DATA_CADASTRO = new Set(["birthDate", "rgDataEmissao"]);
const CAMPOS_PESSOAIS_CADASTRO = new Set(["naturalidade", "profession", "estadoCivil", "escolaridade", "rgNumero", "rgOrgaoEmissor"]);

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

  // Uma solicitação pode ter contato/endereço e/ou "Mais Dados" — cada grupo
  // vai pra sua tarefa de propagação ao Mercúrio. Só aqui, depois de um
  // humano aprovar, é que o Mercúrio é alterado (pedido do usuário 2026-10-19).
  const novos = log.newValues as Record<string, string | null>;
  const contato: Record<string, string | null> = {};
  const pessoais: Record<string, string | Date | null> = {};
  for (const [campo, valor] of Object.entries(novos)) {
    if (CAMPOS_DATA_CADASTRO.has(campo)) pessoais[campo] = valor ? new Date(`${valor}T00:00:00Z`) : null;
    else if (CAMPOS_PESSOAIS_CADASTRO.has(campo)) pessoais[campo] = valor;
    else contato[campo] = valor;
  }

  // E-mail é também o login: troca no Auth junto, senão a pessoa continuaria entrando com o antigo.
  if (contato.email && log.member.authUserId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(log.member.authUserId, { email: contato.email, email_confirm: true });
    if (error) throw new Error("Não foi possível trocar o e-mail de login (pode já estar em uso por outra conta). Nada foi alterado.");
  }

  await db.$transaction([
    db.member.update({ where: { id: log.memberId }, data: { ...contato, ...pessoais } }),
    db.contactChangeLog.update({ where: { id: logId }, data: { status: "aprovado", reviewedAt: new Date() } }),
  ]);

  if (Object.keys(contato).length) await enqueueMercurioContactUpdate(log.memberId, contato);
  if (Object.keys(pessoais).length) await enqueueMercurioPersonalUpdate(log.memberId, pessoais);

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
  revalidatePath("/escolastica");
}
