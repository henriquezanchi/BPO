import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pergunta } from "../src/lib/avaliacao-comum";
import { celula, nomeDoArquivo, planilhaDaRodada } from "../src/lib/avaliacao-planilha";

const P = (id: string, parte: "instrutor" | "geral", texto: string, tipo: "escala" | "texto" = "escala") => ({ id, parte, texto, tipo, min: 1, max: 5 }) as unknown as Pergunta;

test("planilha: uma linha por resposta, colunas do instrutor antes das gerais", () => {
  const csv = planilhaDaRodada(
    "1º semestre",
    [P("g1", "geral", "Nota da escola"), P("i1", "instrutor", "Clareza"), P("i2", "instrutor", "Comentário", "texto")],
    [
      { parte: "instrutor", turmaNome: "N1 Terça", instrutorNome: "Ana", materias: ["Ética", "Filosofia"], respostas: { i1: 5, i2: 'Muito boa; disse "obrigado"' } },
      { parte: "geral", turmaNome: "N1 Terça", instrutorNome: null, materias: [], respostas: { g1: 4 } },
    ],
  );
  assert.ok(csv.startsWith("﻿"));
  const linhas = csv.slice(1).split("\r\n");
  assert.equal(linhas.length, 3);
  assert.equal(linhas[0], '"Rodada";"Parte";"Turma";"Instrutor";"Matérias";"[Instrutor] Clareza";"[Instrutor] Comentário";"[Geral] Nota da escola"');
  assert.equal(linhas[1], '"1º semestre";"Instrutor";"N1 Terça";"Ana";"Ética, Filosofia";"5";"Muito boa; disse ""obrigado""";""');
  assert.equal(linhas[2], '"1º semestre";"Geral";"N1 Terça";"";"";"";"";"4"');
});

test("célula não vira fórmula no Excel", () => {
  assert.equal(celula("=SOMA(A1)"), `"'=SOMA(A1)"`);
  assert.equal(celula("-3"), `"'-3"`);
  assert.equal(celula(null), '""');
});

test("nome do arquivo sem acento nem espaço", () => {
  assert.equal(nomeDoArquivo("Avaliação 1º Semestre / 2026"), "avaliacao-avaliacao-1-semestre-2026.csv");
  assert.equal(nomeDoArquivo("!!!"), "avaliacao-rodada.csv");
});
