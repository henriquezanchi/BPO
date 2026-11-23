import test from "node:test";
import assert from "node:assert/strict";
import { conferirAlteracao, conferirCampo } from "../src/lib/filtro-cadastro";

test("aceita dados normais de cadastro", () => {
  assert.deepEqual(
    conferirAlteracao({
      whatsapp: "(62) 99876-5432", email: "maria.silva@gmail.com", addressStreet: "Rua T-37, Setor Bueno", addressNumber: "1250", addressComplement: "Apto 302, bloco B",
      addressNeighborhood: "Setor Bueno", addressCity: "Goiânia", addressState: "go", addressZip: "74230-020", profession: "Engenheira civil", naturalidade: "Anápolis - GO",
      rgNumero: "1.234.567-X", birthDate: "1985-04-12",
    }),
    { ok: true },
  );
  assert.equal(conferirCampo("addressNumber", "S/N"), null);
  assert.equal(conferirCampo("whatsapp", "+55 61 3333-4444"), null);
});

test("barra digitação acidental (celular no bolso)", () => {
  assert.ok(conferirCampo("addressStreet", "jjjjjjjjjj"));
  assert.ok(conferirCampo("addressNeighborhood", "qwrtpsdfg"));
  assert.ok(conferirCampo("profession", "ççççççç"));
  assert.ok(conferirCampo("addressNumber", "12a3b4"));
});

test("barra mensagens que eram para o WhatsApp", () => {
  assert.ok(conferirCampo("addressStreet", "oi, tudo bem? to chegando"));
  assert.ok(conferirCampo("addressComplement", "kkkkk"));
  assert.ok(conferirCampo("profession", "me liga amanhã"));
  assert.ok(conferirCampo("naturalidade", "Bom dia 🙏"));
  assert.ok(conferirCampo("addressCity", "veja www.exemplo.com"));
});

test("barra telefone, e-mail, CEP e datas impossíveis", () => {
  assert.ok(conferirCampo("whatsapp", "99999999999"));
  assert.ok(conferirCampo("whatsapp", "62 8876-5432 1"));
  assert.ok(conferirCampo("whatsapp", "6288765432a"));
  assert.match(conferirCampo("email", "maria@gmail.con")!, /gmail\.com/);
  assert.ok(conferirCampo("email", "maria gmail.com"));
  assert.ok(conferirCampo("addressZip", "7423"));
  assert.ok(conferirCampo("addressState", "Goiás"));
  assert.ok(conferirCampo("birthDate", "2999-01-01"));
  assert.ok(conferirCampo("whatsapp", ""));
});

test("campo desconhecido é recusado", () => {
  assert.equal(conferirAlteracao({ isDiretor: "true" }).ok, false);
});
