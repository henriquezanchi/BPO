"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { acessoInfantojuvenil, buscarPessoasInfantojuvenil } from "@/lib/infantojuvenil";
import { ehPrograma, lerDataCertidao, programasNaEscola, validadeDaCertidao, type Programa } from "@/lib/infantojuvenil-comum";
import { revalidatePath } from "next/cache";

/** Voluntários do Merlin e do Janos (lib/infantojuvenil.ts). Cada ação reconfere o acesso no servidor. */
const CAMINHO = "/voluntario/merlin-janos";
const erro = (error: string) => ({ ok: false as const, error });

async function quemPode(schoolId: string, programa: Programa) {
  const eu = await getAuthenticatedMember();
  if (!eu) return null;
  const acesso = await acessoInfantojuvenil(eu);
  return programasNaEscola(acesso, schoolId).includes(programa) ? eu : null;
}

export async function buscarPessoasMerlinJanos(termo: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) return [];
  return buscarPessoasInfantojuvenil(await acessoInfantojuvenil(eu), String(termo ?? "").slice(0, 80));
}

export async function marcarVoluntarioInfantojuvenil(memberId: string, programa: string) {
  if (!ehPrograma(programa)) return erro("Programa inválido.");
  const alvo = await db.member.findUnique({ where: { id: memberId }, select: { id: true, schoolId: true, mercurioAtivo: true } });
  if (!alvo?.mercurioAtivo) return erro("Pessoa não encontrada ou inativa.");
  const eu = await quemPode(alvo.schoolId, programa);
  if (!eu) return erro("Você não pode marcar voluntários deste programa nesta filial.");
  await db.voluntarioInfantojuvenil.upsert({
    where: { memberId_programa: { memberId, programa } },
    update: {},
    create: { memberId, programa, schoolId: alvo.schoolId, marcadoPorId: eu.id, atualizadoPorId: eu.id },
  });
  revalidatePath(CAMINHO);
  return { ok: true as const };
}

export async function desmarcarVoluntarioInfantojuvenil(id: string) {
  const reg = await db.voluntarioInfantojuvenil.findUnique({ where: { id }, select: { schoolId: true, programa: true } });
  if (!reg || !ehPrograma(reg.programa)) return erro("Registro não encontrado.");
  if (!(await quemPode(reg.schoolId, reg.programa))) return erro("Você não pode alterar este registro.");
  await db.voluntarioInfantojuvenil.delete({ where: { id } });
  revalidatePath(CAMINHO);
  return { ok: true as const };
}

/** Registra uma verificação da certidão; a anterior vai para o histórico. Validade: 6 meses depois da data. */
export async function registrarCertidaoInfantojuvenil(id: string, dados: { data: string; orgao: string; observacao: string }) {
  const reg = await db.voluntarioInfantojuvenil.findUnique({ where: { id } });
  if (!reg || !ehPrograma(reg.programa)) return erro("Registro não encontrado.");
  const eu = await quemPode(reg.schoolId, reg.programa);
  if (!eu) return erro("Você não pode alterar este registro.");
  const em = lerDataCertidao(String(dados?.data ?? ""), new Date());
  if (!em) return erro("Informe a data da certidão (não pode ser futura nem de mais de 2 anos atrás).");
  const orgao = String(dados?.orgao ?? "").trim().slice(0, 120) || null;
  const observacao = String(dados?.observacao ?? "").trim().slice(0, 500) || null;
  const historico = Array.isArray(reg.historico) ? reg.historico : [];
  const anterior = reg.certidaoEm
    ? [{ em: reg.certidaoEm.toISOString().slice(0, 10), validade: reg.certidaoValidade?.toISOString().slice(0, 10) ?? null, orgao: reg.certidaoOrgao, por: reg.atualizadoPorId }]
    : [];
  await db.voluntarioInfantojuvenil.update({
    where: { id },
    data: {
      certidaoEm: em,
      certidaoValidade: validadeDaCertidao(em),
      certidaoOrgao: orgao,
      observacao,
      atualizadoPorId: eu.id,
      historico: [...anterior, ...historico].slice(0, 20),
    },
  });
  revalidatePath(CAMINHO);
  return { ok: true as const };
}
