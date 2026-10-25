import { db } from "@/lib/db";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
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
type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "filiaisChefiadas" | "mercurioId">;

// Sub-Chefe de Filial também libera (pedido do usuário 2026-10-25), só na própria filial.
const ehChefeDeFilial = (m: Pessoa) => m.isDiretor || m.isSubChefe || m.filiaisChefiadas.length > 0;

/** Filiais em que a pessoa libera acessos: as que chefia e, se é Sub-Chefe, a própria. */
async function escolasQueLibera(m: Pessoa): Promise<string[]> {
  const escolas = await escolasChefiadas(m);
  return m.isSubChefe && !escolas.includes(m.schoolId) ? [...escolas, m.schoolId] : escolas;
}

/** Administração nacional (LiberadorNacional): vale como Chefe de Filial em todas as filiais. */
export async function ehAdministradorNacional(m: Pick<Member, "mercurioId">): Promise<boolean> {
  if (!m.mercurioId) return false;
  if (ehDonoDoSistema(m)) return true;
  return (await db.liberadorNacional.count({ where: { mercurioId: m.mercurioId } })) > 0;
}

/** Escolas (ids) que a pessoa chefia: a própria, se é diretora, e as de filiaisChefiadas — ou todas, se é administração nacional. */
export async function escolasChefiadas(m: Pessoa): Promise<string[]> {
  if (await ehAdministradorNacional(m)) return (await db.school.findMany({ select: { id: true } })).map((s) => s.id);
  const outras = m.filiaisChefiadas.length
    ? (await db.school.findMany({ where: { mercurioUnidade: { in: m.filiaisChefiadas } }, select: { id: true } })).map((s) => s.id)
    : [];
  return [...new Set([...(m.isDiretor ? [m.schoolId] : []), ...outras])];
}

export async function temAcessoVoluntario(m: Pessoa): Promise<boolean> {
  if (ehChefeDeFilial(m) || (await ehAdministradorNacional(m))) return true;
  return (await db.acessoVoluntario.count({ where: { memberId: m.id } })) > 0;
}

/** Ids de quem, dentre os informados, tem acesso — pra filtrar avisos/convites em lote. */
export async function comAcessoVoluntario(memberIds: string[]): Promise<Set<string>> {
  if (!memberIds.length) return new Set();
  const [liberados, diretores] = await Promise.all([
    db.acessoVoluntario.findMany({ where: { memberId: { in: memberIds } }, select: { memberId: true } }),
    db.member.findMany({ where: { id: { in: memberIds }, OR: [{ isDiretor: true }, { isSubChefe: true }, { filiaisChefiadas: { isEmpty: false } }] }, select: { id: true } }),
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
  if (!alvo || alvo.isDiretor) return false;
  if ((await escolasQueLibera(liberador)).includes(alvo.schoolId)) return true;
  const grupos = (await gruposQueLidera(liberador.id)).map((g) => g.classGroupId);
  if (!grupos.length) return false;
  return (await db.classMembership.count({ where: { memberId: alvoId, role: "aluno", classGroupId: { in: grupos } } })) > 0;
}

/** Pessoas que aparecem na tela de liberação deste liberador. */
export async function candidatosParaLiberar(liberador: Pessoa) {
  if (!(await temAcessoVoluntario(liberador))) return [];
  const escolas = await escolasQueLibera(liberador);
  const where = escolas.length
    ? { schoolId: { in: escolas }, mercurioAtivo: true, isDiretor: false, id: { not: liberador.id } }
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
      school: { select: { city: true } },
      isSubChefe: true,
      isSecretarioEscolastica: true,
      isSecretarioEconomia: true,
      schoolId: true,
      classMemberships: { where: { classGroup: { tipo: { not: "turma" } } }, select: { role: true, classGroup: { select: { name: true, tipo: true } } } },
    },
    orderBy: { name: "asc" },
  });
  const ids = pessoas.map((p) => p.id);
  const [acessos, mandatos] = await Promise.all([
    db.acessoVoluntario.findMany({ where: { memberId: { in: ids } } }),
    db.secretariaMandato.findMany({ where: { memberId: { in: ids }, ativo: true }, select: { memberId: true, secretaria: true } }),
  ]);
  const liberados = new Map(acessos.map((l) => [l.memberId, l]));
  return pessoas.map((p) => {
    const chefia = p.classMemberships.filter((c) => c.role === "professor").map((c) => c.classGroup.name);
    const grupos = p.classMemberships.filter((c) => c.role === "aluno").map((c) => c.classGroup.name);
    // Secretarias da pessoa: grupos de secretaria (SEC), secretário de Economia/Escolástica e mandatos na rede.
    const secretarias = [
      ...new Set([
        ...p.classMemberships.filter((c) => c.classGroup.tipo === "SEC").map((c) => c.classGroup.name),
        ...(p.isSecretarioEscolastica ? ["Escolástica"] : []),
        ...(p.isSecretarioEconomia ? ["Economia"] : []),
        ...mandatos.filter((m) => m.memberId === p.id).map((m) => m.secretaria),
      ]),
    ];
    return {
      id: p.id,
      name: p.name,
      filial: escolas.length > 1 ? p.school.city : null,
      schoolId: p.schoolId,
      cidade: p.school.city,
      secretarias,
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
