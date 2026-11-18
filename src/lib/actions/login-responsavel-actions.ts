"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { ehCrianca } from "@/lib/criancas-comum";
import { db } from "@/lib/db";

/**
 * Login que estava preso ao cadastro da criança, mas o e-mail é do responsável (18/11/2026): quando pai/mãe e filho
 * usam o mesmo e-mail, o login foi ligado ao cadastro da criança. Agora que a criança não entra mais, quem está logado
 * (dono do e-mail) passa o login para o cadastro do adulto ativo da mesma filial com esse e-mail — só se houver
 * exatamente um, e ele ainda não tiver login. Mesma conta e mesma senha; nada é recriado.
 */
export async function adultoDoMesmoEmail() {
  const eu = await getAuthenticatedMember();
  if (!eu || !ehCrianca(eu) || !eu.email) return null;
  const adultos = await db.member.findMany({
    where: { mercurioAtivo: true, schoolId: eu.schoolId, email: { equals: eu.email, mode: "insensitive" }, authUserId: null, NOT: { nivel: { in: ["CO", "TA", "JN"] } } },
    select: { id: true, name: true },
  });
  return adultos.length === 1 ? adultos[0] : null;
}

export async function entrarComoResponsavel() {
  const eu = await getAuthenticatedMember();
  if (!eu || !ehCrianca(eu) || !eu.authUserId) return { ok: false as const, error: "Não é possível fazer isso por esta conta." };
  const adulto = await adultoDoMesmoEmail();
  if (!adulto) return { ok: false as const, error: "Não encontramos um único cadastro de adulto com este e-mail. Fale com a secretaria." };
  const authUserId = eu.authUserId;
  await db.$transaction([db.member.update({ where: { id: eu.id }, data: { authUserId: null } }), db.member.update({ where: { id: adulto.id }, data: { authUserId } })]);
  return { ok: true as const };
}
