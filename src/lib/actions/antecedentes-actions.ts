"use server";

import { bloquear, definirSenha, escolasDaDirecao, liberar, registrarAntecedente, type Resultado } from "@/lib/antecedentes";
import { getAuthenticatedMember } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Antecedentes do Maat (lib/antecedentes.ts): só a direção, com a senha exclusiva. */
const CAMINHO = "/voluntario/merlin-janos";
const erro = (error: string) => ({ ok: false as const, error });

async function direcao() {
  const eu = await getAuthenticatedMember();
  if (!eu) return null;
  const escolas = await escolasDaDirecao(eu);
  return escolas === null || escolas.length ? eu : null;
}

async function rodar(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    return erro((e as Error).message);
  }
  revalidatePath(CAMINHO);
  return { ok: true as const };
}

export async function criarOuTrocarSenha(nova: string, atual: string) {
  const eu = await direcao();
  if (!eu) return erro("Só a direção usa esta área.");
  return rodar(() => definirSenha(eu.id, nova, atual || undefined));
}

export async function abrirAntecedentes(senha: string) {
  const eu = await direcao();
  if (!eu) return erro("Só a direção usa esta área.");
  return rodar(() => liberar(eu.id, senha));
}

export async function fecharAntecedentes() {
  return rodar(() => bloquear());
}

export async function salvarAntecedente(d: { memberId: string; resultado: Resultado; pesquisadoEm: string; validade: string; obs: string }) {
  const eu = await direcao();
  if (!eu) return erro("Só a direção usa esta área.");
  return rodar(() => registrarAntecedente(eu, { memberId: d.memberId, resultado: d.resultado, pesquisadoEm: d.pesquisadoEm || null, validade: d.validade || null, obs: d.obs || null }));
}
