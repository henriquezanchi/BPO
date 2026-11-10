import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONARIO_BASE } from "../src/lib/avaliacao-comum";
import { achadosDoInstrutor, analisarRodada, comentarios, correlacao, type RespostaAnalise } from "../src/lib/avaliacao-analise";

const P = QUESTIONARIO_BASE.perguntas;
const inst = (matr: string, nome: string, turma: string, nota: number, texto = ""): RespostaAnalise => ({
  parte: "instrutor",
  classGroupId: turma,
  turmaNome: `Turma ${turma}`,
  instrutorMatr: matr,
  instrutorNome: nome,
  respostas: { instrutor_nota: nota, ...(texto ? { instrutor_aperfeicoar: texto } : {}) },
});
const geral = (turma: string, nps: number, aplicavel: "Sim" | "Não"): RespostaAnalise => ({
  parte: "geral",
  classGroupId: turma,
  turmaNome: `Turma ${turma}`,
  instrutorMatr: null,
  instrutorNome: null,
  respostas: { nps, aplicavel },
});
const rep = <T>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

test("turma em que todos os instrutores vão mal é apontada como assunto da turma", () => {
  const rs = [
    ...rep(4, () => inst("1", "Ana", "A", 9)),
    ...rep(4, () => inst("2", "Bia", "A", 9)),
    ...rep(4, () => inst("1", "Ana", "B", 5)),
    ...rep(4, () => inst("2", "Bia", "B", 5)),
    ...rep(4, () => inst("3", "Caio", "C", 9)),
  ];
  const a = analisarRodada(P, rs);
  assert.ok(a.achadosDirecao.some((x) => x.titulo === "Turma B: a turma toda avalia abaixo"));
  assert.ok(a.achadosDirecao.some((x) => x.titulo === "Ana: resultado muda de uma turma para outra"));
  assert.ok(!a.achadosDirecao.some((x) => x.titulo.startsWith("Ana: abaixo da escola em todas")));
});

test("instrutor abaixo em todas as turmas é apontado como assunto do instrutor", () => {
  const rs = [...rep(4, () => inst("1", "Ana", "A", 5)), ...rep(4, () => inst("1", "Ana", "B", 5)), ...rep(4, () => inst("2", "Bia", "A", 9)), ...rep(4, () => inst("2", "Bia", "B", 9))];
  const a = analisarRodada(P, rs);
  assert.ok(a.achadosDirecao.some((x) => x.titulo === "Ana: abaixo da escola em todas as turmas" && x.tom === "atencao"));
  assert.ok(a.achadosDirecao.some((x) => x.titulo === "Bia: bem acima da média" && x.tom === "positivo"));
  assert.equal(a.achadosDirecao[0].tom, "atencao");
});

test("recomendação cruzada com 'aplicável à vida'", () => {
  const rs = [...rep(5, () => geral("A", 10, "Sim")), ...rep(4, () => geral("A", 4, "Não"))];
  const a = analisarRodada(P, rs);
  const c = a.cruzamentos.find((x) => x.pergunta.id === "aplicavel");
  assert.ok(c);
  assert.deepEqual(
    c!.linhas.map((l) => [l.opcao, l.total, l.media]),
    [
      ["Sim", 5, 10],
      ["Não", 4, 4],
    ],
  );
  assert.ok(a.achadosDirecao.some((x) => x.titulo.startsWith("Recomendação muda conforme")));
  assert.equal(a.recomendacao?.nps, Math.round(((5 - 4) / 9) * 100));
});

test("menos de 3 respostas não aparecem", () => {
  const a = analisarRodada(P, [inst("1", "Ana", "A", 2), inst("1", "Ana", "A", 3)]);
  assert.equal(a.nota?.escola, null);
  assert.deepEqual(a.achadosDirecao, []);
});

test("achados do instrutor e comentários só dele", () => {
  const rs = [...rep(4, () => inst("1", "Ana", "A", 5, "falar mais devagar")), ...rep(6, () => inst("2", "Bia", "A", 9, "ótima"))];
  const a = analisarRodada(P, rs);
  const meus = achadosDoInstrutor(a, "1", rs);
  assert.equal(meus[0].titulo, "Abaixo da média da escola");
  assert.ok(!JSON.stringify(meus).includes("Bia"));
  const cs = comentarios(P, rs, { parte: "instrutor", instrutorMatr: "1" });
  assert.equal(cs.length, 4);
  assert.ok(cs.every((c) => c.texto === "falar mais devagar"));
});

test("correlação", () => {
  assert.equal(correlacao([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(correlacao([1, 2], [1, 2]), null);
});
