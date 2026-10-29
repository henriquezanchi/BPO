import { db } from "@/lib/db";
import { areasNaFilial } from "@/lib/areas-filial";
import { podeAdministrar } from "@/lib/recursos-filial";
import { catalogoDaMateria } from "@/lib/temas-curriculo";
import { AVULSA, TIPOS_AVULSA } from "@/lib/anotacoes-comum";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Anotações das aulas (pedido do usuário 2026-10-29). O aluno anota por matéria (as da própria turma, do Mercúrio)
 * e tema (catálogo de temas-curriculo.ts; matéria sem catálogo aceita tema escrito). Pode compartilhar pelo Portal:
 * o professor da matéria confere em segredo; só "correta" aparece aos colegas do tema, e o autor nunca é avisado.
 * Resumo por IA para estudar (Claude Haiku 5.5), que também aparece na prova do tema.
 */
type Pessoa = { id: string; schoolId: string };
type Gestor = Pessoa & Parameters<typeof podeAdministrar>[0] & Parameters<typeof areasNaFilial>[0];

export async function materiasDoAluno(memberId: string) {
  const turmas = await db.classMembership.findMany({ where: { memberId, role: "aluno", classGroup: { tipo: "turma", arquivadoEm: null } }, select: { classGroupId: true } });
  const vinculos = turmas.length ? await db.turmaMateria.findMany({ where: { classGroupId: { in: turmas.map((t) => t.classGroupId) } }, select: { materiaSigla: true, materiaNome: true } }) : [];
  const porSigla = new Map(vinculos.map((v) => [v.materiaSigla, v.materiaNome]));
  return [...porSigla].map(([sigla, nome]) => ({ sigla, nome, temas: catalogoDaMateria(sigla)?.temas.map((t) => t.titulo) ?? [] })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function carregarAnotacoes(eu: Pessoa, escolha?: { sigla?: string; tema?: string; tipo?: string }) {
  const [materias, minhas] = await Promise.all([
    materiasDoAluno(eu.id),
    db.anotacaoAula.findMany({ where: { memberId: eu.id }, orderBy: { updatedAt: "desc" }, select: { id: true, materiaSigla: true, materiaNome: true, tema: true, texto: true, compartilhada: true, resumo: true, createdAt: true, updatedAt: true } }),
  ]);
  // Aula fora da turma (palestra, curso especial...): sempre disponível, com título livre.
  const sigla = escolha?.sigla && (escolha.sigla === AVULSA || materias.some((m) => m.sigla === escolha.sigla) || minhas.some((a) => a.materiaSigla === escolha.sigla)) ? escolha.sigla : null;
  const tema = sigla && escolha?.tema ? escolha.tema.slice(0, 160) : null;
  const atual = sigla && tema ? (minhas.find((a) => a.materiaSigla === sigla && a.tema === tema) ?? null) : null;
  // Dos colegas: só as conferidas como corretas pelo professor (nunca as incorretas nem as pendentes).
  const colegas =
    sigla && tema
      ? (
          await db.anotacaoAula.findMany({
            where: { schoolId: eu.schoolId, materiaSigla: sigla, tema, compartilhada: true, revisao: "correta", memberId: { not: eu.id } },
            orderBy: { revisadoEm: "desc" },
            take: 10,
            select: { id: true, resumo: true, texto: true, member: { select: { name: true } } },
          })
        ).map((a) => ({ id: a.id, autor: primeiroNome(a.member.name), texto: a.resumo ?? a.texto }))
      : [];
  return {
    materias,
    minhas: minhas.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() })),
    escolha:
      sigla && tema
        ? {
            sigla,
            tema,
            materiaNome:
              sigla === AVULSA
                ? (atual?.materiaNome ?? (TIPOS_AVULSA as readonly string[]).find((t) => t === escolha?.tipo) ?? "Outra")
                : (materias.find((m) => m.sigla === sigla)?.nome ?? atual?.materiaNome ?? sigla),
          }
        : null,
    atual: atual && { ...atual, createdAt: atual.createdAt.toISOString(), updatedAt: atual.updatedAt.toISOString() },
    colegas,
  };
}
export type DadosAnotacoes = Awaited<ReturnType<typeof carregarAnotacoes>>;

const primeiroNome = (nome: string) => {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

/** Quem confere a anotação: o instrutor da matéria na turma do aluno, ou a administração/Escolástica da filial. */
export async function podeConferir(eu: Gestor, anotacao: { memberId: string; schoolId: string; materiaSigla: string }) {
  if ((await podeAdministrar(eu, anotacao.schoolId)) || (await areasNaFilial(eu, anotacao.schoolId)).includes("escolastica")) return true;
  const turmas = await db.classMembership.findMany({ where: { memberId: anotacao.memberId, role: "aluno" }, select: { classGroupId: true } });
  return !!(await db.turmaMateria.count({ where: { classGroupId: { in: turmas.map((t) => t.classGroupId) }, materiaSigla: anotacao.materiaSigla, instrutorMemberId: eu.id } }));
}

/** Anotações compartilhadas pelos alunos de uma turma, nas matérias que o professor dá ali (todas, para a administração). */
export async function anotacoesParaConferir(eu: Gestor, turmaId: string) {
  const turma = await db.classGroup.findUnique({ where: { id: turmaId }, select: { schoolId: true } });
  if (!turma) return [];
  const admin = (await podeAdministrar(eu, turma.schoolId)) || (await areasNaFilial(eu, turma.schoolId)).includes("escolastica");
  const siglas = admin ? undefined : (await db.turmaMateria.findMany({ where: { classGroupId: turmaId, instrutorMemberId: eu.id }, select: { materiaSigla: true } })).map((m) => m.materiaSigla);
  if (siglas && !siglas.length) return [];
  const alunos = (await db.classMembership.findMany({ where: { classGroupId: turmaId, role: "aluno" }, select: { memberId: true } })).map((a) => a.memberId);
  const lista = await db.anotacaoAula.findMany({
    where: { memberId: { in: alunos }, compartilhada: true, ...(siglas ? { materiaSigla: { in: siglas } } : {}) },
    orderBy: [{ revisao: "asc" }, { compartilhadaEm: "desc" }],
    take: 60,
    select: { id: true, materiaNome: true, materiaSigla: true, tema: true, texto: true, resumo: true, revisao: true, compartilhadaEm: true, member: { select: { name: true } } },
  });
  return lista.map((a) => ({ ...a, aluno: a.member.name, compartilhadaEm: a.compartilhadaEm?.toISOString() ?? null }));
}

/** Resumos da própria pessoa e dos colegas (corretos) para os temas de uma prova. */
export async function resumosParaTemas(eu: Pessoa, temas: string[]) {
  if (!temas.length) return [];
  const notas = await db.anotacaoAula.findMany({
    where: { tema: { in: temas }, OR: [{ memberId: eu.id }, { schoolId: eu.schoolId, compartilhada: true, revisao: "correta" }], resumo: { not: null } },
    select: { id: true, tema: true, resumo: true, memberId: true },
  });
  return notas.map((n) => ({ id: n.id, tema: n.tema, resumo: n.resumo!, meu: n.memberId === eu.id }));
}

const Resumo = z.object({ resumo: z.string().describe("Resumo de estudo em português, em tópicos curtos.") });

/** Resumo de estudo das anotações (Claude Haiku 5.5, esforço baixo; ~R$ 0,003 por resumo). */
export async function resumirComIA(materia: string, tema: string, texto: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("O resumo por IA ainda não está configurado.");
  const resposta = await new Anthropic().messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Resumo) },
    messages: [
      {
        role: "user",
        content: `Você ajuda um aluno da escola de filosofia Nova Acrópole a estudar para a prova. Abaixo estão as anotações que ele fez na aula de "${materia}", tema "${tema}".
Escreva um resumo de estudo em português do Brasil: de 5 a 10 tópicos curtos (linhas começando com "• "), com as ideias centrais e os termos importantes, na ordem em que fazem sentido para estudar. Use só o que está nas anotações: não acrescente fatos, autores ou citações que não estejam nelas. Se as anotações forem curtas demais para resumir, devolva-as organizadas em tópicos.

Anotações:
${texto.slice(0, 12000)}`,
      },
    ],
  });
  if (resposta.stop_reason === "refusal") throw new Error("Não foi possível resumir estas anotações.");
  const resumo = resposta.parsed_output?.resumo?.trim();
  if (!resumo) throw new Error("A IA não devolveu um resumo. Tente de novo.");
  return resumo.slice(0, 6000);
}
