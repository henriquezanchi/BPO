import test from "node:test";
import assert from "node:assert/strict";
import { apelidosDeTurma } from "../src/lib/mercurio-db/turmas";

test("turma do aluno sem cadastro casa com a única turma oficial de mesmo código + números", () => {
  const m = apelidosDeTurma(["XESOTRIS", "ACRO", "SOLTA"], ["XESOTRIS1", "ACRO1", "ACRO2", "SOLTAB", "OUTRA"]);
  assert.deepEqual([...m], [["XESOTRIS1", "XESOTRIS"]]);
});
