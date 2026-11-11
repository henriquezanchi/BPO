import assert from "node:assert/strict";
import { test } from "node:test";
import { ehFormacao, rotuloFormacao, validarMotivo } from "../src/lib/solicitacoes-pedagogo-comum";

test("formação aceita só o texto do Mercúrio", () => {
  assert.equal(ehFormacao("EM FORMAÇÃO"), true);
  assert.equal(ehFormacao("INSTRUTOR"), true);
  assert.equal(ehFormacao("instrutor"), false);
  assert.equal(rotuloFormacao("EM FORMAÇÃO"), "Em formação");
});

test("motivo precisa de uma frase e tem limite", () => {
  assert.equal(validarMotivo("   curto ").ok, false);
  const ok = validarMotivo("  Concluiu o N1 e está na turma de pedagogos.  ");
  assert.deepEqual(ok, { ok: true, texto: "Concluiu o N1 e está na turma de pedagogos." });
  assert.equal(validarMotivo("x".repeat(1001)).ok, false);
});
