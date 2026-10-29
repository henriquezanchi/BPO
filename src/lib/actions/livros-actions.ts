"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { SITUACOES_LIVRO, type SituacaoLivro } from "@/lib/livros";
import { revalidatePath } from "next/cache";

/** Meus livros na Área de Estudos (2026-10-29; antes no Diário Filosófico). Cada um mexe só nos próprios. */
type Resultado = { ok: true } | { ok: false; error: string };
const situacao = (s: string): SituacaoLivro => (s in SITUACOES_LIVRO ? (s as SituacaoLivro) : "quero");

async function executar(fn: (memberId: string) => Promise<void>): Promise<Resultado> {
  try {
    const eu = await getAuthenticatedMember();
    if (!eu) throw new Error("Entre no Portal.");
    await fn(eu.id);
    revalidatePath("/estudos/livros");
    return { ok: true };
  } catch (e) {
    console.error("Livros:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error && !/prisma|database|invocation/i.test(e.message) ? e.message : "Não foi possível salvar agora." };
  }
}

export async function adicionarLivro(entrada: { titulo: string; autor: string; situacao: string }) {
  return executar(async (memberId) => {
    const titulo = entrada.titulo.trim().slice(0, 200);
    if (!titulo) throw new Error("Escreva o título do livro.");
    if ((await db.livroLeitura.count({ where: { memberId } })) >= 300) throw new Error("Limite de 300 livros.");
    await db.livroLeitura.create({ data: { memberId, titulo, autor: entrada.autor.trim().slice(0, 160) || null, situacao: situacao(entrada.situacao) } });
  });
}

export async function mudarSituacaoLivro(id: string, nova: string) {
  return executar(async (memberId) => {
    const r = await db.livroLeitura.updateMany({ where: { id, memberId }, data: { situacao: situacao(nova) } });
    if (!r.count) throw new Error("Livro não encontrado.");
  });
}

export async function removerLivro(id: string) {
  return executar(async (memberId) => {
    const r = await db.livroLeitura.deleteMany({ where: { id, memberId } });
    if (!r.count) throw new Error("Livro não encontrado.");
  });
}
