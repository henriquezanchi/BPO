import assert from "node:assert/strict";
import test from "node:test";
import { fusoDaEscola, mesNoFuso, instanteNoFuso } from "../src/lib/fuso-escola";

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

test("deslocamento ISO do fuso", async () => {
  const { deslocamentoNoFuso } = await import("../src/lib/fuso-escola");
  assert.equal(deslocamentoNoFuso("America/Sao_Paulo"), "-03:00");
  assert.equal(deslocamentoNoFuso("America/Cuiaba"), "-04:00");
});

test("hora sem fuso vale como hora da filial; com fuso passa igual", () => {
  assert.equal(instanteNoFuso("2025-06-16T08:30", "America/Sao_Paulo"), "2025-06-16T11:30:00.000Z");
  assert.equal(instanteNoFuso("2025-06-16T08:30", "America/Cuiaba"), "2025-06-16T12:30:00.000Z");
  assert.equal(instanteNoFuso("2025-06-16T08:30:00Z", "America/Sao_Paulo"), "2025-06-16T08:30:00Z");
  assert.equal(instanteNoFuso("qualquer", "America/Sao_Paulo"), "qualquer");
});
