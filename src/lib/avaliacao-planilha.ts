import type { Pergunta } from "./avaliacao-comum";

/**
 * Planilha de uma rodada da avaliação dos instrutores (pedido da Escolástica, 10/11/2026: "extrair uma planilha com
 * todas as respostas para uma análise ampla"). Uma linha por resposta, uma coluna por pergunta. Sem data nem nada que
 * ligue a resposta ao aluno: só o que a tela de respostas individuais já mostra (turma, instrutor e matérias).
 * Formato que o Excel abre direto no Brasil: UTF-8 com BOM, ponto e vírgula e quebra de linha CRLF.
 */
export type LinhaResposta = { parte: string; turmaNome: string | null; instrutorNome: string | null; materias: string[]; respostas: unknown };

/** Aspas, aspas dobradas e proteção contra fórmula (célula começando com =, +, - ou @). */
export const celula = (v: unknown) => `"${String(v ?? "").replace(/^(\s*[=+@-]|[\t\r])/, "'$&").replaceAll('"', '""')}"`;

export function planilhaDaRodada(titulo: string, perguntas: Pergunta[], linhas: LinhaResposta[]): string {
  const ordem = [...perguntas.filter((p) => p.parte === "instrutor"), ...perguntas.filter((p) => p.parte === "geral")];
  const cabecalho = ["Rodada", "Parte", "Turma", "Instrutor", "Matérias", ...ordem.map((p) => (p.parte === "instrutor" ? `[Instrutor] ${p.texto}` : `[Geral] ${p.texto}`))];
  const corpo = linhas.map((l) => {
    const r = (l.respostas ?? {}) as Record<string, unknown>;
    return [
      titulo,
      l.parte === "instrutor" ? "Instrutor" : "Geral",
      l.turmaNome ?? "",
      l.parte === "instrutor" ? (l.instrutorNome ?? "") : "",
      l.materias.join(", "),
      ...ordem.map((p) => (p.parte === l.parte ? (r[p.id] ?? "") : "")),
    ];
  });
  return "﻿" + [cabecalho, ...corpo].map((linha) => linha.map(celula).join(";")).join("\r\n");
}

export const nomeDoArquivo = (titulo: string) =>
  `avaliacao-${
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "rodada"
  }.csv`;
