import { db } from "@/lib/db";
import type { Member } from "@prisma/client";

/**
 * Área de voluntários (grupos Feminino/Masculino/de Segurança, avisos,
 * escalas) é informação sensível — pedido do usuário 2026-10-18: nada
 * aparece por padrão. Liberação em camadas, de cima pra baixo:
 *  - Chefe de Filial (isDiretor) tem acesso sempre e libera qualquer pessoa
 *    da filial (foco: chefes de grupo, sub-chefes, secretários);
 *  - quem já foi liberado e é responsável por um grupo libera os
 *    integrantes desse grupo (vínculos que o sistema já conhece).
 */
type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor">;

export async function temAcessoVoluntario(m: Pessoa): Promise<boolean> {
  if (m.isDiretor) return true;
  return (await db.acessoVoluntario.count({ where: { memberId: m.id } })) > 0;
}

/** Ids de quem, dentre os informados, tem acesso — pra filtrar avisos/convites em lote. */
export async function comAcessoVoluntario(memberIds: string[]): Promise<Set<string>> {
  if (!memberIds.length) return new Set();
  const [liberados, diretores] = await Promise.all([
    db.acessoVoluntario.findMany({ where: { memberId: { in: memberIds } }, select: { memberId: true } }),
    db.member.findMany({ where: { id: { in: memberIds }, isDiretor: true }, select: { id: true } }),
  ]);
  return new Set([...liberados.map((l) => l.memberId), ...diretores.map((d) => d.id)]);
}

/** Grupos (não-turma) em que a pessoa é responsável. */
async function gruposQueLidera(memberId: string) {
  return db.classMembership.findMany({
    where: { memberId, role: "professor", classGroup: { tipo: { not: "turma" } } },
    select: { classGroupId: true },
  });
}

/** Quem esta pessoa pode liberar/revogar — reconferido no servidor a cada ação. */
export async function podeLiberar(liberador: Pessoa, alvoId: string): Promise<boolean> {
  if (alvoId === liberador.id) return false;
  if (!(await temAcessoVoluntario(liberador))) return false;
  const alvo = await db.member.findUnique({ where: { id: alvoId }, select: { schoolId: true, isDiretor: true } });
  if (!alvo || alvo.schoolId !== liberador.schoolId || alvo.isDiretor) return false;
  if (liberador.isDiretor) return true;
  const grupos = (await gruposQueLidera(liberador.id)).map((g) => g.classGroupId);
  if (!grupos.length) return false;
  return (await db.classMembership.count({ where: { memberId: alvoId, role: "aluno", classGroupId: { in: grupos } } })) > 0;
}

/** Pessoas que aparecem na tela de liberação deste liberador. */
export async function candidatosParaLiberar(liberador: Pessoa) {
  if (!(await temAcessoVoluntario(liberador))) return [];
  const where = liberador.isDiretor
    ? { schoolId: liberador.schoolId, mercurioAtivo: true, isDiretor: false, id: { not: liberador.id } }
    : {
        id: { not: liberador.id },
        mercurioAtivo: true,
        classMemberships: { some: { role: "aluno" as const, classGroupId: { in: (await gruposQueLidera(liberador.id)).map((g) => g.classGroupId) } } },
      };
  const pessoas = await db.member.findMany({
    where,
    select: {
      id: true,
      name: true,
      cargos: true,
      isSubChefe: true,
      isSecretarioEscolastica: true,
      isSecretarioEconomia: true,
      classMemberships: { where: { classGroup: { tipo: { not: "turma" } } }, select: { role: true, classGroup: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });
  const liberados = new Map(
    (await db.acessoVoluntario.findMany({ where: { memberId: { in: pessoas.map((p) => p.id) } } })).map((l) => [l.memberId, l]),
  );
  return pessoas.map((p) => {
    const chefia = p.classMemberships.filter((c) => c.role === "professor").map((c) => c.classGroup.name);
    const grupos = p.classMemberships.filter((c) => c.role === "aluno").map((c) => c.classGroup.name);
    return {
      id: p.id,
      name: p.name,
      papel: [
        ...chefia.map((g) => `Responsável · ${g}`),
        ...(p.isSubChefe ? ["Sub-Chefe"] : []),
        ...(p.isSecretarioEscolastica ? ["Secretaria de Escolástica"] : []),
        ...(p.isSecretarioEconomia ? ["Secretaria de Economia"] : []),
      ],
      grupos,
      // Sugeridos no topo pro Chefe de Filial: chefes de grupo, sub-chefes, secretários.
      sugerido: chefia.length > 0 || p.isSubChefe || p.isSecretarioEscolastica || p.isSecretarioEconomia,
      liberado: liberados.has(p.id),
      liberadoEm: liberados.get(p.id)?.liberadoEm ?? null,
    };
  });
}
