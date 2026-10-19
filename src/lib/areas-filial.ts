import { escolasChefiadas } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { normalizar } from "@/lib/profissoes";
import type { Member } from "@prisma/client";

/**
 * Áreas de trabalho da filial na Área do Voluntário (pedido do usuário
 * 2026-10-19: a direção trabalha dentro da Área do Voluntário com acesso a
 * tudo; cada secretário vê a sua área). O que era o Painel da Direção foi
 * distribuído assim:
 *  - direcao: Visão da filial (resumo de cada área), relatório, profissões;
 *  - escolastica: membros (cadastro), pendências, solicitações de correção;
 *  - economia: situação da contribuição, recuperação de crédito, contas e
 *    conciliações, composição da contribuição, tesouraria;
 *  - eventos: gestão de eventos e calendário;
 *  - cafe: Caixa Fortuna.
 * Direção (chefe, sub-chefe, chefias e administração nacional) tem todas.
 * As demais: o cargo do Mercúrio (Secretaria de Escolástica/Economia) ou ser
 * responsável pela secretaria com esse nome no Portal (Administração →
 * Secretarias). A equipe da secretaria não entra na área (dados sensíveis).
 */
export const AREAS_FILIAL = ["direcao", "escolastica", "economia", "eventos", "cafe"] as const;
export type AreaFilial = (typeof AREAS_FILIAL)[number];

const AREA_DA_SECRETARIA: [AreaFilial, RegExp][] = [
  ["escolastica", /ESCOLAST/],
  ["economia", /ECONOMIA|TESOURARIA/],
  ["eventos", /EVENTO/],
  ["cafe", /CAFE/],
];

type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "isSecretarioEscolastica" | "isSecretarioEconomia" | "filiaisChefiadas" | "mercurioId" | "mercurioAtivo">;

export async function areasNaFilial(m: Pessoa, schoolId: string): Promise<AreaFilial[]> {
  if (!m.mercurioAtivo) return [];
  const chefe = (m.schoolId === schoolId && m.isDiretor) || (await escolasChefiadas(m)).includes(schoolId);
  if (chefe) return [...AREAS_FILIAL];
  // Sub-chefe: tudo o que o chefe tem, menos o que o chefe retirou manualmente.
  if (m.schoolId === schoolId && m.isSubChefe) {
    const retiradas = new Set((await db.acessoRetiradoSubchefe.findMany({ where: { schoolId, memberId: m.id }, select: { area: true } })).map((r) => r.area));
    return AREAS_FILIAL.filter((a) => !retiradas.has(a));
  }
  const areas = new Set<AreaFilial>();
  if (m.schoolId === schoolId && m.isSecretarioEscolastica) areas.add("escolastica");
  if (m.schoolId === schoolId && m.isSecretarioEconomia) areas.add("economia");
  const secretarias = await db.classMembership.findMany({
    where: { memberId: m.id, role: "professor", classGroup: { schoolId, tipo: "SEC", arquivadoEm: null } },
    select: { classGroup: { select: { name: true } } },
  });
  for (const s of secretarias) {
    const nome = normalizar(s.classGroup.name);
    for (const [area, re] of AREA_DA_SECRETARIA) if (re.test(nome)) areas.add(area);
  }
  return [...areas];
}
