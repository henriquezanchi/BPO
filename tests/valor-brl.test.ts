import assert from "node:assert/strict";
import test from "node:test";
import { lerValorBRL } from "../src/lib/valor-brl";

test("valor em reais: vírgula decimal, ponto de milhar e ponto decimal com até 2 casas", () => {
  assert.equal(lerValorBRL("20"), 20);
  assert.equal(lerValorBRL("20,5"), 20.5);
  assert.equal(lerValorBRL("20,50"), 20.5);
  assert.equal(lerValorBRL("R$ 20,00"), 20);
  assert.equal(lerValorBRL("1.234,56"), 1234.56);
  assert.equal(lerValorBRL("1.234"), 1234);
  // O caso que gerava R$ 2.000,00 (31/10/2026).
  assert.equal(lerValorBRL("20.00"), 20);
  assert.equal(lerValorBRL("20.5"), 20.5);
  assert.equal(lerValorBRL("1.234.567"), 1234567);
});

test("valor em reais: rejeita o que não é valor", () => {
  assert.equal(lerValorBRL(""), null);
  assert.equal(lerValorBRL("abc"), null);
  assert.equal(lerValorBRL("-5"), null);
  assert.equal(lerValorBRL("1,2,3"), null);
});
