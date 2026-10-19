"use server";

import { ehAdministradorNacional } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember, requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ResumoProfissoes } from "@/lib/mercurio-db/resumo-profissoes";

async function lerResumo(): Promise<ResumoProfissoes | null> {
  const r = await db.resumoNacional.findUnique({ where: { chave: "profissoes" } });
  return r ? (r.dados as unknown as ResumoProfissoes) : null;
}

/** Painel nacional: só a administração nacional (LiberadorNacional). */
export async function getProfissoesNacional(): Promise<ResumoProfissoes | null> {
  const member = await getAuthenticatedMember();
  if (!member || !(await ehAdministradorNacional(member))) throw new Error("Sem permissão para o painel nacional.");
  return lerResumo();
}

/** Relatório da Filial: só o recorte da unidade da escola. */
export async function getProfissoesFilial(schoolId: string): Promise<ResumoProfissoes | null> {
  await requireDirector(schoolId);
  const [resumo, escola] = await Promise.all([lerResumo(), db.school.findUnique({ where: { id: schoolId }, select: { mercurioUnidade: true } })]);
  const uni = escola?.mercurioUnidade;
  if (!resumo || !uni) return null;
  return { ...resumo, unidades: resumo.unidades.filter((u) => u.id === uni), porUnidade: { [uni]: resumo.porUnidade[uni] ?? {} } };
}
