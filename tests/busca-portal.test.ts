import test from "node:test";
import assert from "node:assert/strict";
import { buscarLocal, FUNCOES_PORTAL } from "../src/lib/busca-portal";

const primeiro = (q: string) => buscarLocal(q, FUNCOES_PORTAL)[0]?.funcao.id;

test("busca local: palavras do dia a dia levam à função certa, sem acento e com erro de digitação", () => {
  assert.equal(primeiro("comprovante"), "situacao");
  assert.equal(primeiro("segunda via do boleto"), "situacao");
  assert.equal(primeiro("lanche"), "fortuna");
  assert.equal(primeiro("diario"), "diario");
  assert.equal(primeiro("prologo"), "diario");
  assert.equal(primeiro("anotaçoes"), "anotacoes");
  assert.equal(primeiro("avaliasao"), "avaliacao");
  assert.equal(primeiro("mudar meu telefone"), "cadastro");
});

test("busca local: nada parecido devolve vazio; palavras vazias não contam", () => {
  assert.deepEqual(buscarLocal("xyzw", FUNCOES_PORTAL), []);
  assert.deepEqual(buscarLocal("o de", FUNCOES_PORTAL), []);
});
