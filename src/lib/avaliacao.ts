import { escolasChefiadas } from "@/lib/acesso-voluntario";
import { lerPerguntas, MINIMO_RESPOSTAS, QUESTIONARIO_BASE, type Pergunta, type Questionario } from "@/lib/avaliacao-comum";
import { db } from "@/lib/db";
import type { Member } from "@prisma/client";

/**
 * Avaliação de instrutores (pedido do usuário 2026-10-19):
 *  - invisível até a Direção (Chefe/Sub-Chefe) ou a Secretaria de
 *    Escolástica abrir uma rodada;
 *  - o aluno só avalia os instrutores da PRÓPRIA turma, com as matérias
 *    deles (vínculo oficial em TurmaMateria, vindo do Mercúrio);
 *  - respostas anônimas: AvaliacaoResposta não tem memberId; quem respondeu
 *    fica só em AvaliacaoParticipacao (sem data), pra impedir resposta dupla;
 *  - relatórios só mostram recortes com pelo menos MINIMO_RESPOSTAS.
 */

type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "isSecretarioEscolastica" | "filiaisChefiadas" | "mercurioId">;

export async function escolasQueGereAvaliacao(m: Pessoa): Promise<string[]> {
  const ids = new Set(await escolasChefiadas(m));
  if (m.isSubChefe || m.isSecretarioEscolastica) ids.add(m.schoolId);
  return [...ids];
}

export async function podeGerirAvaliacao(m: Pessoa, schoolId: string) {
  return (await escolasQueGereAvaliacao(m)).includes(schoolId);
}

export async function questionarioDaFilial(schoolId: string): Promise<Questionario & { personalizado: boolean }> {
  const q = await db.avaliacaoQuestionario.findUnique({ where: { schoolId } });
  if (!q) return { ...QUESTIONARIO_BASE, personalizado: false };
  return { titulo: q.titulo, introducao: q.introducao, perguntas: lerPerguntas(q.perguntas), personalizado: true };
}

export interface InstrutorAvaliavel {
  alvo: string; // "instrutor:<matr>:<classGroupId>"
  instrutorMatr: string;
  instrutorNome: string;
  classGroupId: string;
  turmaNome: string;
  materias: string[];
}

/** Instrutores que este aluno pode avaliar nesta rodada: os da(s) turma(s) em que ele é aluno. */
export async function instrutoresDoAluno(m: Pick<Member, "id" | "mercurioId">, campanha: { schoolId: string; turmas: string[] }): Promise<InstrutorAvaliavel[]> {
  const turmas = await db.classMembership.findMany({
    where: {
      memberId: m.id,
      role: "aluno",
      classGroup: { schoolId: campanha.schoolId, tipo: "turma", ...(campanha.turmas.length ? { id: { in: campanha.turmas } } : {}) },
    },
    select: { classGroupId: true, classGroup: { select: { name: true } } },
  });
  if (!turmas.length) return [];
  const materias = await db.turmaMateria.findMany({
    where: { classGroupId: { in: turmas.map((t) => t.classGroupId) }, ...(m.mercurioId ? { instrutorMatr: { not: m.mercurioId } } : {}) },
    orderBy: [{ instrutorNome: "asc" }, { materiaNome: "asc" }],
  });
  const nomeTurma = new Map(turmas.map((t) => [t.classGroupId, t.classGroup.name]));
  const porAlvo = new Map<string, InstrutorAvaliavel>();
  for (const tm of materias) {
    const alvo = `instrutor:${tm.instrutorMatr}:${tm.classGroupId}`;
    const atual = porAlvo.get(alvo);
    if (atual) atual.materias.push(tm.materiaNome);
    else
      porAlvo.set(alvo, {
        alvo,
        instrutorMatr: tm.instrutorMatr,
        instrutorNome: tm.instrutorNome,
        classGroupId: tm.classGroupId,
        turmaNome: nomeTurma.get(tm.classGroupId) ?? "",
        materias: [tm.materiaNome],
      });
  }
  return [...porAlvo.values()];
}

/** Rodada aberta da filial em que o aluno ainda tem algo a responder — é o que faz o quadrinho aparecer. */
export async function avaliacaoPendente(m: Pick<Member, "id" | "mercurioId" | "schoolId">) {
  const campanhas = await db.avaliacaoCampanha.findMany({ where: { schoolId: m.schoolId, status: "aberta" }, orderBy: { abertaEm: "desc" } });
  for (const c of campanhas) {
    const instrutores = await instrutoresDoAluno(m, c);
    const temGeral = lerPerguntas(c.perguntas).some((p) => p.parte === "geral");
    const alvos = [...instrutores.map((i) => i.alvo), ...(temGeral ? ["geral"] : [])];
    if (!alvos.length) continue;
    const feitos = await db.avaliacaoParticipacao.count({ where: { campanhaId: c.id, memberId: m.id, alvo: { in: alvos } } });
    if (feitos < alvos.length) return { campanhaId: c.id, titulo: c.titulo };
  }
  return null;
}

// ----------------------------------------------------------------- relatórios

export interface FiltroRelatorio {
  classGroupId?: string;
  instrutorMatr?: string;
}

function resumoPergunta(p: Pergunta, valores: unknown[]) {
  const respondidas = valores.filter((v) => v !== undefined && v !== null && v !== "");
  if (p.tipo === "escala") {
    const nums = respondidas.map(Number).filter((n) => Number.isFinite(n));
    const media = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
    const distribuicao = Array.from({ length: p.max! - p.min! + 1 }, (_, i) => ({ valor: p.min! + i, total: nums.filter((n) => n === p.min! + i).length }));
    // Índice de recomendação (NPS) quando a escala é 0–10.
    const nps = p.min === 0 && p.max === 10 && nums.length ? Math.round(((nums.filter((n) => n >= 9).length - nums.filter((n) => n <= 6).length) / nums.length) * 100) : null;
    return { tipo: "escala" as const, total: nums.length, media, distribuicao, nps };
  }
  if (p.tipo === "escolha") {
    return { tipo: "escolha" as const, total: respondidas.length, contagem: (p.opcoes ?? []).map((o) => ({ opcao: o, total: respondidas.filter((v) => v === o).length })) };
  }
  return { tipo: "texto" as const, total: respondidas.length, textos: respondidas.map(String) };
}

/** Relatório de uma rodada, com filtros por turma e/ou instrutor. Recortes com menos de MINIMO_RESPOSTAS ficam ocultos. */
export async function relatorioCampanha(campanhaId: string, filtro: FiltroRelatorio) {
  const campanha = await db.avaliacaoCampanha.findUniqueOrThrow({ where: { id: campanhaId } });
  const perguntas = lerPerguntas(campanha.perguntas);
  const todas = await db.avaliacaoResposta.findMany({ where: { campanhaId }, orderBy: { dia: "asc" } });

  const instrutorRespostas = todas.filter(
    (r) => r.parte === "instrutor" && (!filtro.classGroupId || r.classGroupId === filtro.classGroupId) && (!filtro.instrutorMatr || r.instrutorMatr === filtro.instrutorMatr),
  );
  // A parte geral não tem instrutor; filtra só por turma (quando a turma está no filtro).
  const geralRespostas = todas.filter((r) => r.parte === "geral" && (!filtro.classGroupId || r.classGroupId === filtro.classGroupId));

  const montar = (parte: "instrutor" | "geral", lista: typeof todas) => {
    const ps = perguntas.filter((p) => p.parte === parte);
    const suficiente = lista.length >= MINIMO_RESPOSTAS;
    return {
      total: lista.length,
      suficiente,
      perguntas: suficiente ? ps.map((p) => ({ pergunta: p, resumo: resumoPergunta(p, lista.map((r) => (r.respostas as Record<string, unknown>)[p.id])) })) : [],
      individuais: suficiente
        ? lista.map((r) => ({ id: r.id, dia: r.dia, turma: r.turmaNome, instrutor: r.instrutorNome, materias: r.materias, respostas: r.respostas as Record<string, unknown> }))
        : [],
    };
  };

  // Ranking por instrutor e por turma (média da 1ª pergunta de escala do bloco do instrutor), só com recortes suficientes.
  const escalaInstrutor = perguntas.find((p) => p.parte === "instrutor" && p.tipo === "escala");
  const agrupar = (chave: (r: (typeof todas)[number]) => string | null, rotulo: (r: (typeof todas)[number]) => string) => {
    const grupos = new Map<string, { rotulo: string; notas: number[]; total: number }>();
    for (const r of todas.filter((x) => x.parte === "instrutor")) {
      const k = chave(r);
      if (!k) continue;
      const g = grupos.get(k) ?? { rotulo: rotulo(r), notas: [], total: 0 };
      g.total++;
      const v = escalaInstrutor ? Number((r.respostas as Record<string, unknown>)[escalaInstrutor.id]) : NaN;
      if (Number.isFinite(v)) g.notas.push(v);
      grupos.set(k, g);
    }
    return [...grupos.entries()]
      .map(([id, g]) => ({ id, rotulo: g.rotulo, total: g.total, media: g.total >= MINIMO_RESPOSTAS && g.notas.length ? g.notas.reduce((s, n) => s + n, 0) / g.notas.length : null }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  };

  return {
    campanha: { id: campanha.id, titulo: campanha.titulo, status: campanha.status, abertaEm: campanha.abertaEm, encerradaEm: campanha.encerradaEm, schoolId: campanha.schoolId },
    escalaInstrutor: escalaInstrutor?.texto ?? null,
    porInstrutor: agrupar((r) => r.instrutorMatr, (r) => r.instrutorNome ?? "—"),
    porTurma: agrupar((r) => r.classGroupId, (r) => r.turmaNome ?? "—"),
    instrutor: montar("instrutor", instrutorRespostas),
    geral: montar("geral", geralRespostas),
  };
}

export type RelatorioCampanha = Awaited<ReturnType<typeof relatorioCampanha>>;
