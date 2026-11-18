"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { acessoInfantojuvenil } from "@/lib/infantojuvenil";
import { acessoVazio } from "@/lib/infantojuvenil-comum";
import { buscarAdultos, decidirVinculo, gerarSugestoes, vincularExterno, vincularMembro } from "@/lib/responsaveis";
import { revalidatePath } from "next/cache";

/** Vínculos criança ↔ responsável (lib/responsaveis.ts). Cada ação reconfere o acesso no servidor. */
const CAMINHO = "/voluntario/merlin-janos";
const erro = (error: string) => ({ ok: false as const, error });

async function contexto() {
  const eu = await getAuthenticatedMember();
  if (!eu) return null;
  const acesso = await acessoInfantojuvenil(eu);
  return acessoVazio(acesso) ? null : { eu, acesso };
}

async function rodar(fn: (c: NonNullable<Awaited<ReturnType<typeof contexto>>>) => Promise<unknown>) {
  const c = await contexto();
  if (!c) return erro("Sem acesso.");
  try {
    await fn(c);
  } catch (e) {
    return erro((e as Error).message);
  }
  revalidatePath(CAMINHO);
  return { ok: true as const };
}

export async function sugerirResponsaveis() {
  const c = await contexto();
  if (!c) return erro("Sem acesso.");
  const novas = await gerarSugestoes(c.acesso, c.eu.id);
  revalidatePath(CAMINHO);
  return { ok: true as const, novas };
}

export async function decidir(vinculoId: string, confirmar: boolean) {
  return rodar((c) => decidirVinculo(c.acesso, vinculoId, confirmar, c.eu.id));
}

export async function adicionarResponsavelMembro(criancaId: string, memberId: string, parentesco: string) {
  return rodar((c) => vincularMembro(c.acesso, criancaId, memberId, parentesco.trim() || null, c.eu.id));
}

export async function adicionarResponsavelExterno(criancaId: string, d: { nome: string; email: string; celular: string; cpf: string; parentesco: string }) {
  return rodar((c) => vincularExterno(c.acesso, criancaId, { nome: d.nome, email: d.email || null, celular: d.celular || null, cpf: d.cpf || null, parentesco: d.parentesco.trim() || null }, c.eu.id));
}

export async function procurarAdultos(criancaId: string, termo: string) {
  const c = await contexto();
  if (!c) return [];
  return buscarAdultos(c.acesso, criancaId, termo).catch(() => []);
}
