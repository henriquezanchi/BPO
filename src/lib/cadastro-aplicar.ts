import { db } from "@/lib/db";
import { enqueueMercurioContactUpdate, enqueueMercurioPersonalUpdate } from "@/lib/mercurio/sync-queue";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Aplica uma alteração de cadastro registrada em ContactChangeLog: grava no Portal, troca o e-mail de login quando
 * muda o e-mail, e manda para o Mercúrio (fila do robô) ou, sem escrita liberada na filial, deixa um lembrete para a
 * secretaria. Usada pela aprovação da Escolástica e, desde 23/11/2026, direto pelo próprio membro (o filtro em
 * lib/filtro-cadastro.ts barra antes o que não é dado de cadastro).
 */
const CAMPOS_DATA_CADASTRO = new Set(["birthDate", "rgDataEmissao"]);
const CAMPOS_PESSOAIS_CADASTRO = new Set(["naturalidade", "profession", "estadoCivil", "escolaridade", "rgNumero", "rgOrgaoEmissor"]);

export async function aplicarAlteracaoCadastro(logId: string) {
  const log = await db.contactChangeLog.findUniqueOrThrow({ where: { id: logId }, include: { member: true } });
  if (log.status !== "pendente") throw new Error("Solicitação já foi revisada.");

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

  const escola = await db.school.findUniqueOrThrow({ where: { id: log.member.schoolId }, select: { mercurioEscrita: true } });
  if (escola.mercurioEscrita) {
    if (Object.keys(contato).length) await enqueueMercurioContactUpdate(log.memberId, contato);
    if (Object.keys(pessoais).length) await enqueueMercurioPersonalUpdate(log.memberId, pessoais);
  } else {
    // Filial ainda sem escrita no Mercúrio liberada (School.mercurioEscrita): lembrete para a secretaria atualizar à mão.
    const campos = Object.entries({ ...contato, ...pessoais }).map(([c, v]) => `${c}: ${v instanceof Date ? v.toLocaleDateString("pt-BR") : String(v ?? "")}`);
    await db.scholasticPendency.create({
      data: { schoolId: log.member.schoolId, memberId: log.memberId, tipo: "atualizar_mercurio", title: `Atualizar no Mercúrio o cadastro de ${log.member.name}`, notes: campos.join("; "), dueDate: new Date() },
    });
  }
  return log;
}
