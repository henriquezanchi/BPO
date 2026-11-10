import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acessoVazio,
  direcaoPorFuncao,
  lerDataCertidao,
  programasNaEscola,
  programasNoTexto,
  situacaoDaCertidao,
  validadeDaCertidao,
} from "../src/lib/infantojuvenil-comum";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

test("programas citados no texto da função ou da secretaria", () => {
  assert.deepEqual(programasNoTexto("COLABORADORA DO PROGRAMA MERLIN"), ["MERLIN"]);
  assert.deepEqual(programasNoTexto("PRO SECRETARIA DO PROGRAMA MERLIM"), ["MERLIN"]);
  assert.deepEqual(programasNoTexto("Secretária do Janos"), ["JANOS"]);
  assert.deepEqual(programasNoTexto("Programas infantojuvenis"), ["MERLIN", "JANOS"]);
  assert.deepEqual(programasNoTexto("SECRETARIA DE ECONOMIA"), []);
});

test("só secretário, pró, sub ou coordenador dirige; colaborador e monitor não", () => {
  assert.deepEqual(direcaoPorFuncao(["SECRETÁRIA DO JANOS"]), [{ programa: "JANOS", nacional: false }]);
  assert.deepEqual(direcaoPorFuncao(["PRÓ SECRETARIA DE JANOS"]), [{ programa: "JANOS", nacional: false }]);
  assert.deepEqual(direcaoPorFuncao(["SECRETáRIA DO MERLIN"]), [{ programa: "MERLIN", nacional: false }]);
  assert.deepEqual(direcaoPorFuncao(["COORDENADORA NACIONAL DO PROGRAMA MERLIN"]), [{ programa: "MERLIN", nacional: true }]);
  assert.deepEqual(direcaoPorFuncao(["COLABORADORA DO PROGRAMA JANOS", "MONITOR SECRETARIA DE JANOS"]), []);
});

test("validade de 6 meses, com fim de mês", () => {
  assert.equal(iso(validadeDaCertidao(d("2026-11-09"))), "2027-05-09");
  assert.equal(iso(validadeDaCertidao(d("2026-08-31"))), "2027-02-28");
  assert.equal(iso(validadeDaCertidao(d("2027-08-31"))), "2028-02-29");
});

test("situação: sem, vencida, vencendo (até 30 dias) e em dia", () => {
  const hoje = d("2026-11-09");
  assert.equal(situacaoDaCertidao(null, hoje), "sem");
  assert.equal(situacaoDaCertidao(d("2026-11-08"), hoje), "vencida");
  assert.equal(situacaoDaCertidao(d("2026-11-09"), hoje), "vencendo");
  assert.equal(situacaoDaCertidao(d("2026-12-09"), hoje), "vencendo");
  assert.equal(situacaoDaCertidao(d("2026-12-10"), hoje), "emDia");
});

test("data da certidão: formato, futuro e limite de 2 anos", () => {
  const hoje = new Date("2026-11-09T15:00:00Z");
  assert.equal(iso(lerDataCertidao("2026-11-01", hoje)!), "2026-11-01");
  assert.equal(lerDataCertidao("2026-11-20", hoje), null);
  assert.equal(lerDataCertidao("2024-01-01", hoje), null);
  assert.equal(lerDataCertidao("2026-02-30", hoje), null);
  assert.equal(lerDataCertidao("09/11/2026", hoje), null);
});

test("acesso por filial e nacional", () => {
  const a = { todas: ["MERLIN" as const], porEscola: { bga: ["JANOS" as const] } };
  assert.deepEqual(programasNaEscola(a, "bga"), ["MERLIN", "JANOS"]);
  assert.deepEqual(programasNaEscola(a, "gyn"), ["MERLIN"]);
  assert.equal(acessoVazio({ todas: [], porEscola: { bga: [] } }), true);
  assert.equal(acessoVazio(a), false);
});
