import { test } from "node:test";
import assert from "node:assert/strict";
import { camposDoPedido, situacaoDoPedido } from "../src/lib/pedidos-correcao";

test("campos do pedido de correção em nomes que o aluno reconhece", () => {
  assert.deepEqual(camposDoPedido({ addressStreet: "a", addressNumber: "1", addressZip: "2" }), ["Endereço"]);
  assert.deepEqual(camposDoPedido({ whatsapp: "1", email: "x" }), ["WhatsApp", "E-mail"]);
  assert.deepEqual(camposDoPedido({ rgNumero: "1", rgOrgaoEmissor: "SSP", profession: "x", outraCoisa: 1 }), ["RG", "Profissão"]);
  assert.deepEqual(camposDoPedido(null), []);
});

test("situação do pedido", () => {
  assert.equal(situacaoDoPedido("pendente"), "em_analise");
  assert.equal(situacaoDoPedido("rejeitado"), "recusado");
  assert.equal(situacaoDoPedido("aplicado"), null);
});
