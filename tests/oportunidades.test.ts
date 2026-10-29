import test from "node:test";
import assert from "node:assert/strict";
import { estaAberta, quandoDaOportunidade } from "../src/lib/oportunidades-comum";

const base = { encerradaEm: null, abertaAte: null, tipo: "pontual", data: null };

test("oportunidade aberta: sem encerramento, dentro do prazo e com a data por vir (hoje ainda conta)", () => {
  assert.equal(estaAberta(base, "2026-11-08"), true);
  assert.equal(estaAberta({ ...base, data: "2026-11-08" }, "2026-11-08"), true);
  assert.equal(estaAberta({ ...base, data: "2026-11-07" }, "2026-11-08"), false);
  assert.equal(estaAberta({ ...base, abertaAte: "2026-11-07" }, "2026-11-08"), false);
  assert.equal(estaAberta({ ...base, encerradaEm: new Date() }, "2026-11-08"), false);
  // Contínua não vence pela data, só pelo prazo ou encerramento.
  assert.equal(estaAberta({ ...base, tipo: "continua", data: "2020-01-01" }, "2026-11-08"), true);
});

test("quando: data civil sem deslocar o dia; contínua mostra o texto; sem nada, a combinar", () => {
  assert.equal(quandoDaOportunidade({ tipo: "pontual", data: "2026-11-08", horario: "19h às 21h" }), "dom., 08/11 · 19h às 21h");
  assert.equal(quandoDaOportunidade({ tipo: "continua", data: null, horario: "Quintas, 19h às 21h" }), "Quintas, 19h às 21h");
  assert.equal(quandoDaOportunidade({ tipo: "pontual", data: null, horario: null }), "Data a combinar");
});
