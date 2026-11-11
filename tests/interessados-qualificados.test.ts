import assert from "node:assert/strict";
import { test } from "node:test";
import { MOTIVO, motivosDeInteresse } from "../src/lib/aberturas/interessados-qualificados";

const lead = { id: "1", aberturaId: null, naoContatar: false, interesse: { estado: "a_confirmar", fonte: null } };

test("lead do CRM sem sinal não é interessado", () => {
  assert.deepEqual(motivosDeInteresse(lead, [], false), []);
});

test("WhatsApp, aula inaugural e inscrição na abertura contam", () => {
  const s = [
    { tipo: "interesse_declarado", valor: "conhecer", origem: "WhatsApp", occurredAt: "2026-11-01T10:00:00Z" },
    { tipo: "presenca_palestra", valor: true, occurredAt: "2026-11-02T10:00:00Z" },
  ];
  const m = motivosDeInteresse({ ...lead, aberturaId: "ab1" }, s, false);
  assert.ok(m.includes(MOTIVO.whatsapp) && m.includes(MOTIVO.aulaInaugural) && m.includes(MOTIVO.inscricao));
});

test("marcação da escola (disse pessoalmente) conta", () => {
  assert.deepEqual(motivosDeInteresse(lead, [{ tipo: "interesse_declarado", valor: "participar", origem: "Portal" }], false), [MOTIVO.declarado]);
});

test("matriculado, não contatar e 'sem interesse' por último ficam de fora", () => {
  const sim = [{ tipo: "presenca_palestra", valor: true, occurredAt: "2026-11-01T10:00:00Z" }];
  assert.deepEqual(motivosDeInteresse(lead, sim, true), []);
  assert.deepEqual(motivosDeInteresse({ ...lead, naoContatar: true }, sim, false), []);
  assert.deepEqual(motivosDeInteresse(lead, [...sim, { tipo: "interesse_declarado", valor: "nao", occurredAt: "2026-11-03T10:00:00Z" }], false), []);
});

test("sinal do CRM com fonte WhatsApp conta quando o Ulisses enviar", () => {
  assert.deepEqual(motivosDeInteresse({ ...lead, interesse: { estado: "conhecer", fonte: "whatsapp" } }, [], false), [MOTIVO.whatsapp]);
});
