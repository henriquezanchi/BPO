import assert from "node:assert/strict";
import test from "node:test";
import { podeEntrarNaFilial } from "../src/lib/mercurio-db/primeiro-acesso";

const base = { portalAberto: false, matricula: "99999", dirigente: false, liberado: false };

test("filial aberta: qualquer ativo entra", () => {
  assert.equal(podeEntrarNaFilial({ ...base, portalAberto: true }), true);
});

test("filial fechada: só dirigente, liberado pela direção, direção liberada ou dono", () => {
  assert.equal(podeEntrarNaFilial(base), false);
  assert.equal(podeEntrarNaFilial({ ...base, dirigente: true }), true);
  assert.equal(podeEntrarNaFilial({ ...base, liberado: true }), true);
  assert.equal(podeEntrarNaFilial({ ...base, matricula: "2597" }), true); // direção liberada (DIRECAO_LIBERADA)
  assert.equal(podeEntrarNaFilial({ ...base, matricula: "21596" }), true); // dono do sistema
});
