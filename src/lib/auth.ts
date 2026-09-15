import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolve o Member logado a partir da sessão do Supabase Auth (cookie),
 * não de parâmetro de URL. Usar em toda página/server action que expõe
 * dado de um membro — nunca confiar só no proxy.ts pra isso: Server
 * Actions não passam pelo matcher do proxy (ver aviso na doc do Next 16),
 * então qualquer action que recebe um `memberId` precisa validar aqui que
 * ele bate com quem está de fato logado.
 */
export async function getAuthenticatedMember() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return db.member.findUnique({ where: { authUserId: user.id }, include: { school: true } });
}

/**
 * Mesma resolução, mas lança se ninguém estiver logado, o memberId não
 * bater, OU o membro não estiver mais ativo no Mercúrio (mercurioAtivo —
 * sincronizado periodicamente, ver scripts/sync-active-status.ts). Defesa
 * em profundidade: mesmo que uma página deixe passar, nenhuma Server
 * Action de escrita executa pra quem saiu da escola.
 */
export async function requireAuthenticatedMember(expectedMemberId: string) {
  const member = await getAuthenticatedMember();
  if (!member || member.id !== expectedMemberId) {
    throw new Error("Não autenticado ou sem permissão para alterar este cadastro.");
  }
  if (!member.mercurioAtivo) {
    throw new Error("Sua matrícula não está mais ativa — fale com a secretaria da escola.");
  }
  return member;
}

/**
 * Confirma que o membro logado é professor da turma informada — nunca
 * confiar num createdById vindo do client (mesma lógica de defesa em
 * profundidade de requireAuthenticatedMember, aplicada ao papel de
 * professor em vez de "é o próprio membro").
 */
export async function requireTeacherOfClass(classGroupId: string) {
  const member = await getAuthenticatedMember();
  if (!member) throw new Error("Não autenticado.");

  const membership = await db.classMembership.findFirst({
    where: { classGroupId, memberId: member.id, role: "professor" },
  });
  if (!membership) throw new Error("Você não é professor desta turma.");

  return member;
}
