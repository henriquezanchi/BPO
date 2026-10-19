"use server";

import { escolasChefiadas } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ehDirecaoDaFilial, podeAdministrar, RECURSOS, type ChaveRecurso } from "@/lib/recursos-filial";
import { revalidatePath } from "next/cache";

type Resultado = { ok: true } | { ok: false; error: string };

export async function alterarRecursoFilial(schoolId: string, chave: ChaveRecurso, ativo: boolean): Promise<Resultado> {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await podeAdministrar(eu, schoolId))) return { ok: false, error: "Você não administra esta filial." };
  if (!(chave in RECURSOS)) return { ok: false, error: "Recurso desconhecido." };
  await db.recursoFilial.upsert({
    where: { schoolId_chave: { schoolId, chave } },
    update: { ativo, alteradoPorId: eu.id, alteradoEm: new Date() },
    create: { schoolId, chave, ativo, alteradoPorId: eu.id },
  });
  revalidatePath("/admin");
  revalidatePath("/portal");
  return { ok: true };
}

/** Só Chefe/Sub-Chefe (ou administração nacional) escolhe administradores. */
export async function designarAdministrador(schoolId: string, memberId: string): Promise<Resultado> {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await ehDirecaoDaFilial(eu, schoolId))) return { ok: false, error: "Só o Chefe ou o Sub-Chefe da filial escolhe administradores." };
  const alvo = await db.member.findUnique({ where: { id: memberId }, select: { schoolId: true, mercurioAtivo: true } });
  if (!alvo || alvo.schoolId !== schoolId || !alvo.mercurioAtivo) return { ok: false, error: "Escolha alguém ativo desta filial." };
  await db.administradorFilial.upsert({
    where: { schoolId_memberId: { schoolId, memberId } },
    update: {},
    create: { schoolId, memberId, designadoPorId: eu.id },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function removerAdministrador(schoolId: string, memberId: string): Promise<Resultado> {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await ehDirecaoDaFilial(eu, schoolId))) return { ok: false, error: "Só o Chefe ou o Sub-Chefe da filial remove administradores." };
  await db.administradorFilial.deleteMany({ where: { schoolId, memberId } });
  revalidatePath("/admin");
  return { ok: true };
}

/** Áreas que o chefe pode retirar do sub-chefe (por padrão o sub-chefe tem todas). */
const AREAS_RETIRAVEIS = ["direcao", "escolastica", "economia", "eventos", "cafe", "admin"];

/** Só o chefe da filial (ou quem chefia a filial / administração nacional) retira ou devolve acessos do sub-chefe. */
export async function alterarAcessoSubchefe(schoolId: string, memberId: string, area: string, permitido: boolean): Promise<Resultado> {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false, error: "Entre no Portal." };
  const chefe = (eu.schoolId === schoolId && eu.isDiretor) || (await escolasChefiadas(eu)).includes(schoolId);
  if (!chefe) return { ok: false, error: "Só o chefe da filial altera os acessos do sub-chefe." };
  if (!AREAS_RETIRAVEIS.includes(area)) return { ok: false, error: "Área desconhecida." };
  const alvo = await db.member.findUnique({ where: { id: memberId }, select: { schoolId: true, isSubChefe: true } });
  if (!alvo || alvo.schoolId !== schoolId || !alvo.isSubChefe) return { ok: false, error: "Essa pessoa não é sub-chefe desta filial." };
  if (permitido) await db.acessoRetiradoSubchefe.deleteMany({ where: { schoolId, memberId, area } });
  else
    await db.acessoRetiradoSubchefe.upsert({
      where: { schoolId_memberId_area: { schoolId, memberId, area } },
      update: { porId: eu.id, em: new Date() },
      create: { schoolId, memberId, area, porId: eu.id },
    });
  revalidatePath("/", "layout");
  return { ok: true };
}
