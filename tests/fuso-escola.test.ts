import assert from "node:assert/strict";
import test from "node:test";
import { fusoDaEscola, mesNoFuso } from "../src/lib/fuso-escola";

test("fuso da filial pela UF", () => {
  assert.equal(fusoDaEscola("MT"), "America/Cuiaba");
  assert.equal(fusoDaEscola("df"), "America/Sao_Paulo");
  assert.equal(fusoDaEscola(null), "America/Sao_Paulo");
});

test("mês corrente no fuso: 31/10 às 22h em Brasília ainda é outubro (no servidor UTC já seria novembro)", () => {
  const agora = new Date("2026-11-01T01:00:00Z");
  const sp = mesNoFuso("America/Sao_Paulo", agora);
  assert.equal(sp.mes, 10);
  assert.equal(sp.inicio.toISOString(), "2026-10-01T03:00:00.000Z");
  assert.equal(sp.fim.toISOString(), "2026-11-01T03:00:00.000Z");
  assert.equal(sp.inicioCivil.toISOString(), "2026-10-01T00:00:00.000Z");
  const mt = mesNoFuso("America/Cuiaba", agora);
  assert.equal(mt.inicio.toISOString(), "2026-10-01T04:00:00.000Z");
});

test("virada do ano", () => {
  const m = mesNoFuso("America/Sao_Paulo", new Date("2026-12-15T12:00:00Z"));
  assert.equal(m.fim.toISOString(), "2027-01-01T03:00:00.000Z");
  assert.equal(m.fimCivil.toISOString(), "2027-01-01T00:00:00.000Z");
});
