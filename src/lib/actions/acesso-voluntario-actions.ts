"use server";

import { escolasQueLibera, podeLiberar } from "@/lib/acesso-voluntario";
import { AREAS_POR_SECRETARIA, areasDoNome, type AreaPorSecretaria } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function liberarAcessoVoluntario(alvoId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await podeLiberar(eu, alvoId))) return { ok: false as const, error: "Você não pode liberar esta pessoa." };
  await db.acessoVoluntario.upsert({ where: { memberId: alvoId }, update: {}, create: { memberId: alvoId, liberadoPorId: eu.id } });
  revalidatePath("/voluntario/acessos");
  return { ok: true as const };
}

export async function revogarAcessoVoluntario(alvoId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await podeLiberar(eu, alvoId))) return { ok: false as const, error: "Você não pode alterar o acesso desta pessoa." };
  await db.acessoVoluntario.deleteMany({ where: { memberId: alvoId } });
  revalidatePath("/voluntario/acessos");
  return { ok: true as const };
}

/**
 * Dá ou tira uma área de trabalho (Escolástica, Economia, Eventos, Café) direto da tela Liberar acessos (09/11/2026,
 * pedido do usuário). É o mesmo mecanismo da tela de Secretarias: a pessoa vira responsável pela secretaria da área na
 * filial dela (criada se ainda não existe). Só quem chefia a filial da pessoa (chefe, sub-chefe, administração nacional).
 * Área que vem da função no Mercúrio não se tira por aqui.
 */
export async function definirAreaDeTrabalho(alvoId: string, area: AreaPorSecretaria, ativa: boolean) {
  const eu = await getAuthenticatedMember();
  if (!eu || !(area in AREAS_POR_SECRETARIA)) return { ok: false as const, error: "Pedido inválido." };
  const alvo = await db.member.findUnique({ where: { id: alvoId }, select: { id: true, schoolId: true, mercurioAtivo: true } });
  if (!alvo?.mercurioAtivo) return { ok: false as const, error: "Pessoa não encontrada ou inativa." };
  if (!(await escolasQueLibera(eu)).includes(alvo.schoolId)) return { ok: false as const, error: "Só a direção da filial desta pessoa dá áreas de trabalho." };

  const secretarias = (await db.classGroup.findMany({ where: { schoolId: alvo.schoolId, tipo: "SEC", arquivadoEm: null }, select: { id: true, name: true } })).filter((g) =>
    areasDoNome(g.name).includes(area),
  );
  if (ativa) {
    const grupo = secretarias[0] ?? (await db.classGroup.create({ data: { schoolId: alvo.schoolId, tipo: "SEC", name: AREAS_POR_SECRETARIA[area], criadoPorId: eu.id } }));
    await db.classMembership.upsert({
      where: { classGroupId_memberId_role: { classGroupId: grupo.id, memberId: alvo.id, role: "professor" } },
      update: {},
      create: { classGroupId: grupo.id, memberId: alvo.id, role: "professor" },
    });
    await db.acessoVoluntario.upsert({ where: { memberId: alvo.id }, update: {}, create: { memberId: alvo.id, liberadoPorId: eu.id } });
  } else {
    await db.classMembership.deleteMany({ where: { memberId: alvo.id, role: "professor", classGroupId: { in: secretarias.map((g) => g.id) } } });
  }
  revalidatePath("/voluntario/acessos");
  return { ok: true as const };
}
