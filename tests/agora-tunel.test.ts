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

test("ações do Ágora (página inicial dele) viram a agenda: nova inscrição e já inscrito", async () => {
  const { agendaDasAcoes } = await import("../src/lib/agora/eventos");
  const itens = agendaDasAcoes(
    [
      { contexto: "Encontro Nacional de GGSS 31/10/2026", contextoId: "enc-gs-ita", imagemId: 17, info: " Valor: R$ 485", aviso: "Restam 2 dias Lote 3", regiao: "NAC", tipo: "INSCRICAO_NOVA" },
      { contexto: "Encontro Nacional GM 20/11/2026", contextoId: 15044, imagemId: 1569, info: null, aviso: null, regiao: "NAC", tipo: "INSCRICAO_EDITAR" },
      { contexto: "Voluntariado Anápolis e Asa Norte 14/11/2026", contextoId: "vol-faz-14-11-26", imagemId: 18, info: "Restam 14 dias Lote 1 Valor: R$ 110", aviso: null, regiao: "RCO", tipo: "INSCRICAO_NOVA" },
      { contexto: "Outra coisa", contextoId: "x", tipo: "AVISO_GERAL" },
    ],
    [{ id: 15, nome: "Encontro Nacional GM", data: "2026-11-20", slug: "enc-gm-faz", nacional: true, texto: "Descrição do GM" }],
  );
  assert.equal(itens.length, 3, "só ações de inscrição");
  const [ggss, gm, vol] = itens.map((i) => (i.kind === "evento" ? i : null));
  assert.equal(ggss?.title, "Encontro Nacional de GGSS");
  assert.equal(ggss?.date.toISOString(), "2026-10-31T03:00:00.000Z");
  assert.equal(ggss?.registrationUrl, "https://eventos.acropolebrasil.com.br/#/e/enc-gs-ita");
  assert.deepEqual(ggss?.agora, { inscrito: false, valor: "R$ 485", prazo: "Restam 2 dias Lote 3" });
  assert.equal(ggss?.scope, "nacional");
  assert.equal(gm?.agora?.inscrito, true);
  assert.equal(gm?.registrationUrl, "https://eventos.acropolebrasil.com.br/#/e/enc-gm-faz", "já inscrito: leva ao evento casado pelo nome");
  assert.equal(gm?.description, "Descrição do GM");
  assert.equal(vol?.scope, "regional");
  assert.deepEqual(vol?.agora, { inscrito: false, valor: "R$ 110", prazo: "Restam 14 dias Lote 1" });
  assert.equal(vol?.posterUrl, "https://eventos.acropolebrasil.com.br/e/og/imagem/18");
});
