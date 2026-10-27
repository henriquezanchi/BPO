import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { cifrar, decifrar } from "../src/lib/segredo-cifrado";
import { agendaDoAgora, dataDoAgora } from "../src/lib/agora/eventos";

// A chave é lida na hora de cifrar; nos testes, uma aleatória.
process.env.MATRICULA_CPF_CHAVE ??= crypto.randomBytes(32).toString("base64");

test("segredo cifrado: ida e volta, finalidades com chaves diferentes, adulteração recusada", () => {
  const c = cifrar("token-de-teste", "sessao-agora");
  assert.notEqual(c, "token-de-teste");
  assert.equal(decifrar(c, "sessao-agora"), "token-de-teste");
  assert.throws(() => decifrar(c, "outra-finalidade"));
  const [iv, tag, dados] = c.split(".");
  assert.throws(() => decifrar([iv, tag, dados.slice(0, -2) + (dados.endsWith("A") ? "BB" : "AA")].join("."), "sessao-agora"));
});

test("data do Ágora: ISO sem fuso é horário de Brasília; aceita epoch e lista", () => {
  assert.equal(dataDoAgora("2026-11-07T08:00:00")?.toISOString(), "2026-11-07T11:00:00.000Z");
  assert.equal(dataDoAgora("2026-11-07T08:00:00Z")?.toISOString(), "2026-11-07T08:00:00.000Z");
  assert.equal(dataDoAgora([2026, 11, 7, 8, 30])?.toISOString(), "2026-11-07T11:30:00.000Z");
  assert.equal(dataDoAgora(Date.UTC(2026, 10, 7))?.toISOString(), "2026-11-07T00:00:00.000Z");
  assert.equal(dataDoAgora("lixo"), null);
});

test("evento do Ágora vira item da agenda com inscrição no Ágora", () => {
  const [item] = agendaDoAgora([
    { id: 77, nome: " Encontro Nacional ", data: "2026-11-20T19:30:00", duracao: 120, slug: "encontro-nacional", imagem: { id: 9 }, nacional: true, situacao: "PUBLICADO", texto: "<p>Texto&nbsp;do evento</p>" },
    { id: 78, data: "2026-11-21T19:30:00" },
  ]);
  assert.ok(item && item.kind === "evento");
  if (item.kind !== "evento") return;
  assert.equal(item.title, "Encontro Nacional");
  assert.equal(item.scope, "nacional");
  assert.equal(item.source, "agora");
  assert.equal(item.registrationUrl, "https://eventos.acropolebrasil.com.br/#/e/encontro-nacional");
  assert.equal(item.posterUrl, "https://eventos.acropolebrasil.com.br/e/og/imagem/9");
  assert.equal(item.description, "Texto do evento");
  assert.equal(item.endsAt?.toISOString(), "2026-11-21T00:30:00.000Z");
  assert.equal(agendaDoAgora([{ id: 78, data: "2026-11-21T19:30:00" }]).length, 0, "sem nome, fica de fora");
  const [soDia] = agendaDoAgora([{ id: 79, nome: "Encontro Nacional GM", data: "2026-11-20", nacional: true }]);
  assert.ok(soDia.kind === "evento" && soDia.allDay && soDia.endsAt === null, "só a data: dia inteiro");
});
