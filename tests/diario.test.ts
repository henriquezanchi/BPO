import test from "node:test";
import assert from "node:assert/strict";
import { datasPermitidas, epilogoValido, fogoInterno, fraseDoDia, praticaNoDia } from "../src/lib/diario";

test("diário: hoje e no máximo 3 dias anteriores", () => {
  assert.deepEqual(datasPermitidas("2026-11-01"), ["2026-11-01", "2026-10-31", "2026-10-30", "2026-10-29"]);
});

test("Fogo Interno: sequência terminando hoje ou ontem, recorde e graus do diário antigo", () => {
  const f = fogoInterno(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-26", "2026-10-27", "2026-10-28"], "2026-10-29");
  assert.equal(f.atual, 3);
  assert.equal(f.recorde, 3);
  assert.equal(f.grau.titulo, "Chama Desperta");
  assert.equal(f.proximo?.titulo, "Tocha Iluminadora");
  assert.equal(f.faltam, 4);
  assert.equal(fogoInterno(["2026-10-26"], "2026-10-29").atual, 0, "sequência quebrada");
  assert.equal(fogoInterno([], "2026-10-29").grau.titulo, "Cinzas Frias");
});

test("práticas: diária, dias da semana, a cada 14 dias e dia do mês", () => {
  const base = { diasSemana: [] as number[], diaMes: null, dataBase: "2026-10-01" };
  assert.equal(praticaNoDia({ ...base, recorrencia: "diaria" }, "2026-10-29"), true);
  assert.equal(praticaNoDia({ ...base, recorrencia: "semanal", diasSemana: [4] }, "2026-10-29"), true, "29/10/2026 é quinta");
  assert.equal(praticaNoDia({ ...base, recorrencia: "semanal", diasSemana: [1] }, "2026-10-29"), false);
  assert.equal(praticaNoDia({ ...base, recorrencia: "quinzenal" }, "2026-10-15"), true);
  assert.equal(praticaNoDia({ ...base, recorrencia: "quinzenal" }, "2026-10-16"), false);
  assert.equal(praticaNoDia({ ...base, recorrencia: "mensal", diaMes: 29 }, "2026-10-29"), true);
});

test("epílogo: três respostas ou reflexão livre; frase fixa no dia", () => {
  assert.equal(epilogoValido({ falhei: "a", fizBem: "b", deixeiDeFazer: "c" }), true);
  assert.equal(epilogoValido({ falhei: "a", fizBem: " " }), false);
  assert.equal(epilogoValido({ reflexaoLivre: "dia bom" }), true);
  assert.deepEqual(fraseDoDia("2026-10-29"), fraseDoDia("2026-10-29"));
  assert.notDeepEqual(fraseDoDia("2026-10-29"), fraseDoDia("2026-10-30"));
});
