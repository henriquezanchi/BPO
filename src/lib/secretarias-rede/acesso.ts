import { db } from "@/lib/db";
import { ehAdministradorNacional, escolasChefiadas, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { areasNaFilial } from "@/lib/areas-filial";
import type { Member } from "@prisma/client";
import type { ContextoSecretaria, MandatoRede, ResponsabilidadeLocal } from "@/lib/secretarias-rede/regras";

export * from "@/lib/secretarias-rede/regras";

export type PessoaAtiva = Pick<Member, "id" | "schoolId" | "mercurioId" | "mercurioAtivo" | "isDiretor" | "isSubChefe" | "isSecretarioEscolastica" | "isSecretarioEconomia" | "filiaisChefiadas">;

export function pessoaEstaAtiva(member: Pick<Member, "mercurioAtivo"> | null): member is Pick<Member, "mercurioAtivo"> {
  return !!member?.mercurioAtivo;
}

export function exigirPessoaAtiva(member: PessoaAtiva | null): asserts member is PessoaAtiva {
  if (!member || !member.mercurioAtivo) throw new Error("Entre com uma conta ativa para acessar esta secretaria.");
}

export async function listarEscolasRede() {
  return db.school.findMany({
    select: { id: true, name: true, city: true, uf: true },
    orderBy: [{ uf: "asc" }, { name: "asc" }],
  });
}

export async function carregarContextoSecretaria(member: PessoaAtiva): Promise<ContextoSecretaria> {
  exigirPessoaAtiva(member);
  const acessoEquipe = await temAcessoVoluntario(member);
  const [administradorNacional, mandatos, memberships, escolas, headed, areas] = await Promise.all([
    ehAdministradorNacional(member),
    db.secretariaMandato.findMany({ where: { memberId: member.id, ativo: true } }),
    db.classMembership.findMany({
      where: {
        memberId: member.id,
        ...(acessoEquipe ? { role: { in: ["professor", "aluno"] } } : { role: "professor" }),
        classGroup: { tipo: "SEC", arquivadoEm: null },
      },
      select: {
        role: true,
        classGroup: { select: { name: true, schoolId: true, school: { select: { uf: true } } } },
      },
    }),
    listarEscolasRede(),
    escolasChefiadas(member),
    areasNaFilial(member, member.schoolId),
  ]);
  const responsabilidades: ResponsabilidadeLocal[] = memberships.map((membership) => ({
    secretaria: membership.classGroup.name,
    schoolId: membership.classGroup.schoolId,
    uf: membership.classGroup.school.uf,
    papel: membership.role === "professor" ? "responsavel" : "equipe",
  }));
  for(const [ativo,nome] of [[member.isSecretarioEconomia,'Economia'],[member.isSecretarioEscolastica,'Escolástica']] as const){
    if(ativo&&!responsabilidades.some(r=>r.secretaria===nome&&r.schoolId===member.schoolId))responsabilidades.push({secretaria:nome,schoolId:member.schoolId,uf:escolas.find(e=>e.id===member.schoolId)?.uf??null,papel:'responsavel'});
  }
  return {
    member,
    administradorNacional,
    mandatos: mandatos as MandatoRede[],
    responsabilidades,
    escolas,
    escolasChefiadas: headed,
    escolasDirecionadas: areas.includes("direcao") ? [...new Set([...headed, member.schoolId])] : headed,
  };
}
