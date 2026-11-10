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

test("data de encerramento: hoje vale, passado e mais de um ano não", async () => {
  const { lerDataEncerramento, encerramentoVencido } = await import("../src/lib/avaliacao-comum");
  const agora = new Date("2026-11-10T15:00:00Z"); // 12h em Brasília
  assert.deepEqual(lerDataEncerramento("", agora), { ok: true, data: null });
  assert.equal(lerDataEncerramento("2026-11-10", agora).ok, true);
  assert.equal(lerDataEncerramento("2026-11-09", agora).ok, false);
  assert.equal(lerDataEncerramento("2027-11-10", agora).ok, true);
  assert.equal(lerDataEncerramento("2027-11-11", agora).ok, false);
  assert.equal(lerDataEncerramento("2026-02-30", agora).ok, false);
  // Último dia 10/11: ainda aberta o dia todo em Brasília, encerrada a partir de 11/11 00h de Brasília (03h UTC).
  const dia = new Date("2026-11-10T00:00:00Z");
  assert.equal(encerramentoVencido(dia, new Date("2026-11-11T02:59:00Z")), false);
  assert.equal(encerramentoVencido(dia, new Date("2026-11-11T03:01:00Z")), true);
  assert.equal(encerramentoVencido(null, agora), false);
});
