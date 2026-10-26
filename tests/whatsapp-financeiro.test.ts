import test from "node:test";
import assert from "node:assert/strict";
import { dataEHora, MODELOS, mesPorExtenso, nomeCurtoDaFilial, primeiroNome, telefoneInternacional, textoDoModelo } from "../src/lib/whatsapp/modelos";

test("modelos da Meta: variáveis em sequência, nunca no começo ou no fim do texto, exemplo para cada uma", () => {
  for (const [nome, m] of Object.entries(MODELOS)) {
    const vars = [...m.texto.matchAll(/\{\{(\d+)\}\}/g)].map((x) => Number(x[1]));
    assert.deepEqual(vars, vars.map((_, i) => i + 1), nome);
    assert.equal(m.exemplo.length, vars.length, nome);
    assert.ok(!/^\s*\{\{/.test(m.texto) && !/\}\}\s*[.!]?$/.test(m.texto), nome);
    assert.ok(/^[a-z][a-z0-9_]*$/.test(nome), nome);
  }
});

test("texto final preenche as variáveis na ordem", () => {
  assert.equal(
    textoDoModelo("na_contribuicao_recebida", ["Maria", "Goiânia Universitário", "outubro/2026", "R$ 150,00"]),
    "Olá, Maria! A Nova Acrópole Goiânia Universitário recebeu sua contribuição de outubro/2026, no valor de R$ 150,00. O recibo fica disponível no Portal do Membro. Obrigado!",
  );
});

test("telefone vira formato internacional; o que não parece celular brasileiro fica de fora", () => {
  assert.equal(telefoneInternacional("(62) 99876-5432"), "5562998765432");
  assert.equal(telefoneInternacional("5562998765432"), "5562998765432");
  assert.equal(telefoneInternacional("6232345678"), "556232345678");
  assert.equal(telefoneInternacional("123"), null);
  assert.equal(telefoneInternacional(""), null);
  assert.equal(telefoneInternacional(null), null);
});

test("nomes, mês e data no fuso da filial", () => {
  assert.equal(primeiroNome("MARIA DA SILVA"), "Maria");
  assert.equal(nomeCurtoDaFilial("Nova Acrópole - Barra do Garças"), "Barra do Garças");
  assert.equal(mesPorExtenso(2026, 10), "outubro/2026");
  assert.equal(dataEHora(new Date("2026-11-15T22:30:00Z"), "America/Sao_Paulo"), "15/11/2026 às 19h30");
  assert.equal(dataEHora(new Date("2026-11-15T23:00:00Z"), "America/Cuiaba"), "15/11/2026 às 19h");
});
