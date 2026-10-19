import { cache } from "react";
import { temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { areasNaFilial, type AreaFilial } from "@/lib/areas-filial";
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
// cache(): a mesma requisição (ex.: a moldura da Área do Voluntário e a página) consulta uma vez só.
export const getAuthenticatedMember = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return db.member.findUnique({ where: { authUserId: user.id }, include: { school: true } });
});

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
 * Confirma que quem está logado é Diretor(a)/Sub-Chefe DA ESCOLA informada
 * — usado por toda Server Action do Painel do Diretor (recuperação de
 * crédito, repasses, Fortuna, detalhe de membro). Mesma defesa em
 * profundidade de requireAuthenticatedMember: a página já reverifica isso
 * em src/app/(member)/diretor/page.tsx, mas Server Actions não passam pelo
 * proxy, então cada uma precisa checar de novo.
 */
/**
 * Acesso por área da filial (areas-filial.ts): a direção passa em todas; o
 * secretário (cargo do Mercúrio ou responsável pela secretaria no Portal),
 * só na dele. Substitui requireDirector nas ações de cada área.
 */
export async function requireArea(schoolId: string, ...areas: AreaFilial[]) {
  const member = await getAuthenticatedMember();
  if (!member || !(await areasNaFilial(member, schoolId)).some((a) => areas.includes(a))) {
    throw new Error("Não autenticado ou sem permissão para esta área da filial.");
  }
  return member;
}

export async function requireDirector(schoolId: string) {
  const member = await getAuthenticatedMember();
  if (!member || member.schoolId !== schoolId || (!member.isDiretor && !member.isSubChefe)) {
    throw new Error("Não autenticado ou sem permissão de Direção nesta escola.");
  }
  return member;
}

/**
 * Confirma que quem está logado é Secretário de Escolástica OU Direção da
 * escola informada — usado pela agenda de pendências (ver
 * escolastica-actions.ts). Direção também gerencia porque, no piloto, ainda
 * não existe ninguém nomeado Secretário de Escolástica em algumas filiais
 * (ver scripts/sync-diretoria.ts) — sem isso, a agenda ficaria sem dono
 * nenhum até o cargo ser preenchido no Mercúrio.
 */
export async function requireEscolasticaOuDirecao(schoolId: string) {
  // Área da filial (areas-filial.ts): cargo do Mercúrio, responsável pela secretaria no Portal ou direção.
  return requireArea(schoolId, "escolastica");
}

/** Mesmo padrão de requireEscolasticaOuDirecao, pro Secretário de Economia (aprova inclusão de item de composição — ver contribution-actions.ts). */
export async function requireEconomiaOuDirecao(schoolId: string) {
  return requireArea(schoolId, "economia");
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
  // Grupos de voluntários exigem acesso liberado (ver acesso-voluntario.ts).
  const grupo = await db.classGroup.findUnique({ where: { id: classGroupId }, select: { tipo: true } });
  if (grupo?.tipo !== "turma" && !(await temAcessoVoluntario(member))) throw new Error("Seu acesso à área de voluntários ainda não foi liberado.");

  return member;
}
