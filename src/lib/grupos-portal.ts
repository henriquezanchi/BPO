import { ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { podeAdministrar } from "@/lib/recursos-filial";
import type { Member } from "@prisma/client";

/**
 * Grupos do Portal (pedido do usuário 2026-10-19). Todos usam ClassGroup,
 * ClassMembership (role "professor" = responsável/coordenação, "aluno" =
 * integrante) e as reuniões do Codex (GroupMeeting/Series):
 *  - GAF: criado pela administração da filial; participantes membros (2º
 *    nível em diante) ou também alunos, se marcado na criação.
 *  - GDVE: criado por FV, visto só por FV, com participantes FV escolhidos.
 *  - SEC: secretaria da filial (administração cria e define responsáveis);
 *    equipe de voluntários e atividades.
 *  - BF/BM/CS: grupos de voluntários vindos do Mercúrio; aqui ganham
 *    atividades e reuniões, mas a composição continua vindo do Mercúrio.
 */
import { TIPOS_FV, ehDeAlunos, ehTipoGrupo, type TipoGrupo } from "@/lib/grupos-comum";
import { areasNaFilial } from "@/lib/areas-filial";

export { TIPOS_GRUPO, TIPOS_FV, TIPOS_DO_PORTAL, TIPOS_DE_ALUNOS, TIPOS_ESTUDO, ehDeAlunos, ehTipoGrupo, MODALIDADES, FREQUENCIAS, type TipoGrupo, type TipoDoPortal } from "@/lib/grupos-comum";

type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "filiaisChefiadas" | "mercurioId" | "mercurioAtivo" | "isMembroPrograma" | "isSecretarioEscolastica" | "isSecretarioEconomia">;

/** FV = integrante ou responsável do Grupo Feminino, Masculino ou de Segurança (BRG no Mercúrio). */
export async function ehFV(memberId: string): Promise<boolean> {
  return (await db.classMembership.count({ where: { memberId, classGroup: { tipo: { in: [...TIPOS_FV] } } } })) > 0;
}

export type Papel = { podeVer: boolean; podeGerir: boolean; integrante: boolean; responsavel: boolean };
const NENHUM: Papel = { podeVer: false, podeGerir: false, integrante: false, responsavel: false };

/** O que a pessoa pode fazer no grupo — reconferido no servidor a cada ação. */
export async function papelNoGrupo(m: Pessoa, grupoId: string): Promise<Papel & { tipo: TipoGrupo; schoolId: string }> {
  const g = await db.classGroup.findUnique({ where: { id: grupoId }, select: { tipo: true, schoolId: true, arquivadoEm: true } });
  if (!g || !ehTipoGrupo(g.tipo) || !m.mercurioAtivo) return { ...NENHUM, tipo: "GAF", schoolId: g?.schoolId ?? "" };
  const vinculos = await db.classMembership.findMany({ where: { classGroupId: grupoId, memberId: m.id }, select: { role: true } });
  const responsavel = vinculos.some((v) => v.role === "professor");
  const integrante = vinculos.some((v) => v.role === "aluno");
  const base = { tipo: g.tipo, schoolId: g.schoolId, responsavel, integrante };
  switch (g.tipo) {
    case "GAF": {
      const admin = (await podeAdministrar(m, g.schoolId)) || (await ehAdministradorNacional(m));
      return { ...base, podeGerir: admin || responsavel, podeVer: admin || responsavel || integrante };
    }
    case "ESTUDO":
    case "LEITURA": {
      // Como o GAF, mais a Escolástica da filial, que acompanha os estudos.
      const admin = (await podeAdministrar(m, g.schoolId)) || (await ehAdministradorNacional(m)) || (await areasNaFilial(m, g.schoolId)).includes("escolastica");
      return { ...base, podeGerir: admin || responsavel, podeVer: admin || responsavel || integrante };
    }
    case "SEC": {
      const admin = (await podeAdministrar(m, g.schoolId)) || (await ehAdministradorNacional(m));
      const acesso = admin || (await temAcessoVoluntario(m));
      return { ...base, podeGerir: admin || (responsavel && acesso), podeVer: admin || ((responsavel || integrante) && acesso) };
    }
    case "GDVE": {
      // Só FV vê o GDVE — nem a administração, se não for FV.
      const fv = (await ehFV(m.id)) && (await temAcessoVoluntario(m));
      return { ...base, podeGerir: fv && responsavel, podeVer: fv && (responsavel || integrante) };
    }
    default: {
      const acesso = await temAcessoVoluntario(m);
      return { ...base, podeGerir: acesso && responsavel, podeVer: acesso && (responsavel || integrante) };
    }
  }
}

/** Quem pode entrar no grupo (reconferido no servidor ao adicionar). */
export async function candidatoElegivel(tipo: TipoGrupo, schoolId: string, permiteAlunos: boolean, alvoId: string): Promise<string | null> {
  const alvo = await db.member.findUnique({ where: { id: alvoId }, select: { schoolId: true, mercurioAtivo: true, isMembroPrograma: true } });
  if (!alvo || !alvo.mercurioAtivo) return "Pessoa inativa ou não encontrada.";
  if (alvo.schoolId !== schoolId) return "A pessoa é de outra filial.";
  if (ehDeAlunos(tipo) && !permiteAlunos && !alvo.isMembroPrograma) return "Este grupo é só para membros (2º nível em diante).";
  if (tipo === "GDVE" && !(await ehFV(alvoId))) return "O GDVE é só para FV.";
  if (TIPOS_FV.includes(tipo as (typeof TIPOS_FV)[number])) return "A composição deste grupo vem do Mercúrio.";
  return null;
}

/** Filtro de candidatos por tipo, para a busca na tela. */
export function filtroCandidatos(tipo: TipoGrupo, schoolId: string, permiteAlunos: boolean) {
  return {
    schoolId,
    mercurioAtivo: true,
    ...(ehDeAlunos(tipo) && !permiteAlunos ? { isMembroPrograma: true } : {}),
    ...(tipo === "GDVE" ? { classMemberships: { some: { classGroup: { tipo: { in: [...TIPOS_FV] } } } } } : {}),
  };
}

/**
 * Grupos do Portal cujos encontros a pessoa vê na Agenda e nos avisos do
 * dia: GAF sempre; secretarias e grupos de FV com acesso de voluntário; GDVE
 * só sendo FV.
 */
export async function gruposDaAgenda(m: Pessoa & { classMemberships: { classGroupId: string; role: string; classGroup: { tipo: string } }[] }): Promise<string[]> {
  if (!m.mercurioAtivo) return [];
  const meus = m.classMemberships.filter((cm) => ehTipoGrupo(cm.classGroup.tipo));
  if (!meus.length) return [];
  const precisaAcesso = meus.some((cm) => !ehDeAlunos(cm.classGroup.tipo));
  const acesso = precisaAcesso ? await temAcessoVoluntario(m) : false;
  const fv = meus.some((cm) => TIPOS_FV.includes(cm.classGroup.tipo as (typeof TIPOS_FV)[number]));
  return [
    ...new Set(
      meus
        .filter((cm) => ehDeAlunos(cm.classGroup.tipo) || (acesso && (cm.classGroup.tipo !== "GDVE" || fv)))
        .map((cm) => cm.classGroupId),
    ),
  ];
}

/**
 * Quem cria grupo de estudo e leitura comentada na filial (pedido do usuário 2026-10-25): qualquer
 * instrutor (pedagogo ou professor de turma) da filial, Chefe, Sub-Chefe, administradores da filial
 * e quem tem a área de Escolástica.
 */
export async function podeCriarEstudo(m: Pessoa & Pick<Member, "isPedagogo">, schoolId: string): Promise<boolean> {
  if ((await podeAdministrar(m, schoolId)) || (await ehAdministradorNacional(m))) return true;
  if (m.schoolId !== schoolId || !m.mercurioAtivo) return false;
  if (m.isPedagogo) return true;
  if ((await db.classMembership.count({ where: { memberId: m.id, role: "professor", classGroup: { schoolId, tipo: "turma" } } })) > 0) return true;
  return (await areasNaFilial(m, schoolId)).includes("escolastica");
}
