import test from "node:test";
import assert from "node:assert/strict";
import { chaveTema, programaDaDisciplina, programaDaSigla, proximoTema, temasFeitos } from "../src/lib/pedagogos-programa";

test("N1 junta Ética, Sociedade e Filosofia da História: 18 temas, na ordem", () => {
  const n1 = programaDaSigla("N1")!;
  assert.equal(n1.disciplinas, 3);
  assert.equal(n1.temas.length, 18);
  assert.deepEqual([n1.temas[0].sigla, n1.temas[6].sigla, n1.temas[13].sigla], ["NET", "NSC", "NFH"]);
  assert.equal(programaDaDisciplina("NSC")?.sigla, "N1");
});

test("trilha individual: próximo tema é o primeiro que a pessoa não fez, mesmo número em outra disciplina não conta", () => {
  const n1 = programaDaSigla("N1")!;
  assert.equal(proximoTema(n1, [])?.titulo, "1. Filosofia natural");
  const feitos = [chaveTema("NET", "1. Filosofia natural"), chaveTema("NSC", "2. Platão")];
  assert.equal(proximoTema(n1, feitos)?.titulo, "2. O ser humano e o cosmos");
  assert.equal(temasFeitos(n1, [...feitos, chaveTema("NET", "1. Filosofia natural")]), 2);
  const todos = n1.temas.map((t) => chaveTema(t.sigla, t.titulo));
  assert.equal(proximoTema(n1, todos), null);
  assert.equal(proximoTema(n1, todos.slice(0, 6))?.sigla, "NSC");
});
