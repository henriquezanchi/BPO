"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { instrutoresDoAluno, podeGerirAvaliacao, questionarioDaFilial } from "@/lib/avaliacao";
import { lerPerguntas, type Pergunta } from "@/lib/avaliacao-comum";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

type Resultado = { ok: true } | { ok: false; error: string };

async function gestor(schoolId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await podeGerirAvaliacao(eu, schoolId))) throw new Error("Só a Direção ou a Secretaria de Escolástica da filial gerenciam a avaliação.");
  return eu;
}

function falha(e: unknown, padrao: string): Resultado {
  return { ok: false, error: e instanceof Error ? e.message : padrao };
}

export async function salvarQuestionario(schoolId: string, q: { titulo: string; introducao: string; perguntas: Pergunta[] }): Promise<Resultado> {
  try {
    const eu = await gestor(schoolId);
    const perguntas = lerPerguntas(q.perguntas);
    if (!perguntas.length) return { ok: false, error: "O questionário precisa de pelo menos uma pergunta válida." };
    if (new Set(perguntas.map((p) => p.id)).size !== perguntas.length) return { ok: false, error: "Há perguntas repetidas." };
    const dados = { titulo: q.titulo.trim() || "Avaliação", introducao: q.introducao.trim(), perguntas: perguntas as unknown as object, atualizadoPorId: eu.id, atualizadoEm: new Date() };
    await db.avaliacaoQuestionario.upsert({ where: { schoolId }, update: dados, create: { schoolId, ...dados } });
    revalidatePath("/escolastica/avaliacao");
    return { ok: true };
  } catch (e) {
    return falha(e, "Não foi possível salvar o questionário.");
  }
}

/** Volta para a base nacional (apaga a versão da filial). */
export async function restaurarQuestionarioBase(schoolId: string): Promise<Resultado> {
  try {
    await gestor(schoolId);
    await db.avaliacaoQuestionario.deleteMany({ where: { schoolId } });
    revalidatePath("/escolastica/avaliacao");
    return { ok: true };
  } catch (e) {
    return falha(e, "Não foi possível restaurar.");
  }
}

/** Abre uma rodada: copia as perguntas atuais da filial (alterações futuras não mexem numa rodada já aberta). */
export async function abrirCampanha(schoolId: string, dados: { titulo: string; turmas: string[] }): Promise<Resultado> {
  try {
    const eu = await gestor(schoolId);
    const q = await questionarioDaFilial(schoolId);
    const turmasValidas = dados.turmas.length
      ? (await db.classGroup.findMany({ where: { id: { in: dados.turmas }, schoolId, tipo: "turma" }, select: { id: true } })).map((t) => t.id)
      : [];
    await db.avaliacaoCampanha.create({
      data: {
        schoolId,
        titulo: dados.titulo.trim() || q.titulo,
        introducao: q.introducao,
        perguntas: q.perguntas as unknown as object,
        turmas: turmasValidas,
        criadoPorId: eu.id,
      },
    });
    revalidatePath("/escolastica/avaliacao");
    revalidatePath("/portal");
    return { ok: true };
  } catch (e) {
    return falha(e, "Não foi possível abrir a avaliação.");
  }
}

export async function alterarStatusCampanha(campanhaId: string, status: "aberta" | "encerrada"): Promise<Resultado> {
  try {
    const c = await db.avaliacaoCampanha.findUniqueOrThrow({ where: { id: campanhaId } });
    await gestor(c.schoolId);
    await db.avaliacaoCampanha.update({ where: { id: campanhaId }, data: { status, encerradaEm: status === "encerrada" ? new Date() : null } });
    revalidatePath("/escolastica/avaliacao");
    revalidatePath("/portal");
    return { ok: true };
  } catch (e) {
    return falha(e, "Não foi possível alterar a avaliação.");
  }
}

function validar(perguntas: Pergunta[], respostas: Record<string, unknown>): { ok: true; limpas: Record<string, string | number> } | { ok: false; error: string } {
  const limpas: Record<string, string | number> = {};
  for (const p of perguntas) {
    const v = respostas[p.id];
    const vazio = v === undefined || v === null || (typeof v === "string" && !v.trim());
    if (vazio) {
      if (p.obrigatoria) return { ok: false, error: `Responda: "${p.texto}"` };
      continue;
    }
    if (p.tipo === "escala") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < p.min! || n > p.max!) return { ok: false, error: `Resposta inválida em "${p.texto}".` };
      limpas[p.id] = n;
    } else if (p.tipo === "escolha") {
      if (!p.opcoes?.includes(String(v))) return { ok: false, error: `Resposta inválida em "${p.texto}".` };
      limpas[p.id] = String(v);
    } else {
      limpas[p.id] = String(v).trim().slice(0, 3000);
    }
  }
  return { ok: true, limpas };
}

/**
 * Envio do aluno. Cada instrutor avaliado (ou marcado como "não tive aula")
 * e a parte geral viram uma participação (pra não responder de novo) e, se
 * respondido, uma resposta ANÔNIMA — id aleatório, sem memberId e só o dia.
 */
export async function responderAvaliacao(
  campanhaId: string,
  envio: { instrutores: { alvo: string; naoTeveAula: boolean; respostas: Record<string, unknown> }[]; geral: Record<string, unknown> | null },
): Promise<Resultado> {
  try {
    const eu = await getAuthenticatedMember();
    if (!eu || !eu.mercurioAtivo) return { ok: false, error: "Faça login para responder." };
    const c = await db.avaliacaoCampanha.findUniqueOrThrow({ where: { id: campanhaId } });
    if (c.status !== "aberta" || c.schoolId !== eu.schoolId) return { ok: false, error: "Esta avaliação não está aberta para você." };
    const perguntas = lerPerguntas(c.perguntas);
    const permitidos = new Map((await instrutoresDoAluno(eu, c)).map((i) => [i.alvo, i]));
    const feitos = new Set((await db.avaliacaoParticipacao.findMany({ where: { campanhaId, memberId: eu.id }, select: { alvo: true } })).map((p) => p.alvo));
    const dia = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}T00:00:00Z`);

    const participacoes: { alvo: string }[] = [];
    const respostas: { id: string; parte: string; classGroupId: string | null; turmaNome: string | null; instrutorMatr: string | null; instrutorNome: string | null; materias: string[]; respostas: object }[] = [];

    for (const item of envio.instrutores) {
      const inst = permitidos.get(item.alvo);
      if (!inst) return { ok: false, error: "Você só pode avaliar os instrutores da sua turma." };
      if (feitos.has(item.alvo)) continue;
      participacoes.push({ alvo: item.alvo });
      if (item.naoTeveAula) continue;
      const v = validar(perguntas.filter((p) => p.parte === "instrutor"), item.respostas);
      if (!v.ok) return { ok: false, error: `${inst.instrutorNome}: ${v.error}` };
      respostas.push({ id: randomUUID(), parte: "instrutor", classGroupId: inst.classGroupId, turmaNome: inst.turmaNome, instrutorMatr: inst.instrutorMatr, instrutorNome: inst.instrutorNome, materias: inst.materias, respostas: v.limpas });
    }

    const perguntasGerais = perguntas.filter((p) => p.parte === "geral");
    if (envio.geral && perguntasGerais.length && !feitos.has("geral")) {
      const v = validar(perguntasGerais, envio.geral);
      if (!v.ok) return v;
      const turma = [...permitidos.values()][0];
      participacoes.push({ alvo: "geral" });
      respostas.push({ id: randomUUID(), parte: "geral", classGroupId: turma?.classGroupId ?? null, turmaNome: turma?.turmaNome ?? null, instrutorMatr: null, instrutorNome: null, materias: [], respostas: v.limpas });
    }

    if (!participacoes.length) return { ok: false, error: "Nada novo para enviar." };
    // Embaralha a ordem de gravação das respostas pra não casar com a ordem das participações.
    respostas.sort(() => Math.random() - 0.5);
    await db.$transaction([
      db.avaliacaoParticipacao.createMany({ data: participacoes.map((p) => ({ campanhaId, memberId: eu.id, alvo: p.alvo })), skipDuplicates: true }),
      db.avaliacaoResposta.createMany({ data: respostas.map((r) => ({ ...r, campanhaId, schoolId: c.schoolId, dia })) }),
    ]);
    revalidatePath("/portal");
    revalidatePath("/avaliacao");
    return { ok: true };
  } catch (e) {
    return falha(e, "Não foi possível enviar suas respostas.");
  }
}
