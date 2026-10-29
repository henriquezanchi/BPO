"use server";

import { podeConferir, materiasDoAluno, resumirComIA } from "@/lib/anotacoes";
import { AVULSA, TIPOS_AVULSA } from "@/lib/anotacoes-comum";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/** Anotações das aulas (2026-10-29): o aluno só mexe nas próprias; a conferência é do professor da matéria. */
type Resultado = { ok: true; id?: string } | { ok: false; error: string };

async function executar(fn: () => Promise<string | void>): Promise<Resultado> {
  try {
    const id = await fn();
    revalidatePath("/estudos/anotacoes");
    return { ok: true, ...(id ? { id } : {}) };
  } catch (e) {
    console.error("Anotações:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error && !/prisma|database|invocation|anthropic|api/i.test(e.message) ? e.message : "Não foi possível agora. Tente de novo." };
  }
}

async function eu() {
  const m = await getAuthenticatedMember();
  if (!m) throw new Error("Entre no Portal.");
  return m;
}

async function minha(id: string) {
  const m = await eu();
  const a = await db.anotacaoAula.findFirst({ where: { id, memberId: m.id } });
  if (!a) throw new Error("Anotação não encontrada.");
  return { m, a };
}

export async function salvarAnotacao(entrada: { sigla: string; tema: string; texto: string; tipo?: string }): Promise<Resultado> {
  return executar(async () => {
    const m = await eu();
    // Aula fora da turma (palestra, curso especial...): título livre; o tipo fica no nome da "matéria".
    const tipo = (TIPOS_AVULSA as readonly string[]).find((t) => t === entrada.tipo) ?? "Outra";
    const materia = entrada.sigla === AVULSA ? { sigla: AVULSA, nome: tipo, temas: [] as string[] } : (await materiasDoAluno(m.id)).find((x) => x.sigla === entrada.sigla);
    if (!materia) throw new Error("Escolha uma matéria da sua turma.");
    const tema = entrada.tema.trim().slice(0, 160);
    if (!tema || (materia.temas.length && !materia.temas.includes(tema))) throw new Error(materia.sigla === AVULSA ? "Dê um título à aula." : "Escolha o tema da aula.");
    const texto = entrada.texto.slice(0, 20000);
    const antes = await db.anotacaoAula.findUnique({ where: { memberId_materiaSigla_tema: { memberId: m.id, materiaSigla: materia.sigla, tema } }, select: { texto: true } });
    // Texto mudou numa anotação compartilhada: volta para o professor conferir de novo.
    const mudou = antes && antes.texto !== texto;
    const a = await db.anotacaoAula.upsert({
      where: { memberId_materiaSigla_tema: { memberId: m.id, materiaSigla: materia.sigla, tema } },
      update: { texto, ...(mudou ? { revisao: "pendente", revisadoEm: null, revisadoPorId: null } : {}) },
      create: { memberId: m.id, schoolId: m.schoolId, materiaSigla: materia.sigla, materiaNome: materia.nome, tema, texto },
    });
    return a.id;
  });
}

export async function compartilharAnotacao(id: string, sim: boolean): Promise<Resultado> {
  return executar(async () => {
    const { a } = await minha(id);
    if (sim && !a.texto.trim()) throw new Error("Escreva a anotação antes de compartilhar.");
    await db.anotacaoAula.update({ where: { id: a.id }, data: sim ? { compartilhada: true, compartilhadaEm: a.compartilhadaEm ?? new Date() } : { compartilhada: false } });
  });
}

export async function resumirAnotacao(id: string): Promise<Resultado> {
  return executar(async () => {
    const { a } = await minha(id);
    if (a.texto.trim().length < 40) throw new Error("Escreva um pouco mais antes de pedir o resumo.");
    // Limite simples de uso: um resumo novo por anotação a cada 2 minutos.
    if (a.resumoEm && Date.now() - a.resumoEm.getTime() < 120_000) throw new Error("Aguarde um pouco para pedir outro resumo.");
    const resumo = await resumirComIA(a.materiaNome ?? a.materiaSigla, a.tema, a.texto);
    await db.anotacaoAula.update({ where: { id: a.id }, data: { resumo, resumoEm: new Date() } });
  });
}

export async function excluirAnotacao(id: string): Promise<Resultado> {
  return executar(async () => {
    const { a } = await minha(id);
    await db.anotacaoAula.delete({ where: { id: a.id } });
  });
}

/** Conferência secreta do professor: o aluno não vê; só "correta" aparece aos colegas. */
export async function conferirAnotacao(id: string, veredito: "correta" | "incorreta" | "pendente"): Promise<Resultado> {
  return executar(async () => {
    const m = await eu();
    const a = await db.anotacaoAula.findUnique({ where: { id }, select: { id: true, memberId: true, schoolId: true, materiaSigla: true, compartilhada: true } });
    if (!a?.compartilhada) throw new Error("Anotação não encontrada.");
    if (!(await podeConferir(m, a))) throw new Error("Só o professor da matéria ou a Escolástica confere.");
    await db.anotacaoAula.update({ where: { id }, data: { revisao: veredito, revisadoPorId: veredito === "pendente" ? null : m.id, revisadoEm: veredito === "pendente" ? null : new Date() } });
    revalidatePath("/professor");
  });
}
