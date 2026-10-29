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

test("descrição do Ágora em Markdown vira texto em linhas; duração em dias; sigla do local vira o nome da sede", async () => {
  const { textoDoAgora, agendaDoAgora } = await import("../src/lib/agora/eventos");
  assert.equal(
    textoDoAgora("# Encontro Nacional de GGSS<br>\n## 31 de outubro a 2 de novembro - Ítaca\n\n**1) Prazos**<br>\nPrazo LOTE 1: 14 de outubro<br>\n* Lote 1: R$ 330,00"),
    "Encontro Nacional de GGSS\n31 de outubro a 2 de novembro - Ítaca\n\n1) Prazos\nPrazo LOTE 1: 14 de outubro\n• Lote 1: R$ 330,00",
  );
  const [e] = agendaDoAgora([{ id: 1, nome: "GGSS", data: "2026-10-31", duracao: 3, local: "ITA", sede: { nome: "ITACA" } }]);
  assert.ok(e.kind === "evento");
  if (e.kind !== "evento") return;
  assert.equal(e.allDay, true);
  assert.equal(e.endsAt?.toISOString(), "2026-11-02T03:00:00.000Z");
  assert.equal(e.location, "ITACA");
});

test("compartilhar evento do Ágora: rótulo nacional, valor real e inscrição no Ágora (não 'da escola' nem 'gratuita')", async () => {
  const { eventoCompartilhavel, textoParaCanal } = await import("../src/lib/compartilhar-evento");
  const e = eventoCompartilhavel(
    { id: "agora-1", title: "Encontro Nacional de GGSS", date: new Date(Date.now() + 5 * 864e5), allDay: true, location: "ITACA", description: "1) Prazos\nLote 1", source: "agora", status: "publicado", registrationUrl: "https://eventos.acropolebrasil.com.br/#/e/enc-gs-ita", scope: "nacional", agora: { inscrito: false, valor: "R$ 485", prazo: null } },
  );
  assert.ok(e);
  assert.equal(e!.chamada, "EVENTO NACIONAL");
  assert.equal(e!.valorTexto, "Inscrição: R$ 485");
  assert.equal(e!.chamadaInscricao, "INSCRIÇÕES NO ÁGORA");
  const zap = textoParaCanal(e!, "whatsapp");
  assert.ok(zap.includes("Inscrição: R$ 485"));
  assert.ok(zap.includes("Inscrições no Ágora: https://eventos.acropolebrasil.com.br/#/e/enc-gs-ita"));
  assert.ok(zap.includes("1) Prazos\nLote 1"), "mantém as quebras da descrição");
  assert.ok(!/gratuit|Portal/i.test(zap));
});

test("cookie do Ágora: renova a cada uso, junta Set-Cookie novos e respeita prazo e remoção", async () => {
  const { cookieRenovado } = await import("../src/lib/agora/sessao");
  const agora = Date.UTC(2026, 9, 29, 12);
  const dia = 24 * 3600e3;
  assert.deepEqual(cookieRenovado("JSESSIONID=a; XSRF=b", [], agora), { cookie: "JSESSIONID=a; XSRF=b", ate: agora + dia }, "sem Set-Cookie: mais 1 dia");
  assert.deepEqual(cookieRenovado("JSESSIONID=a; XSRF=b", ["JSESSIONID=c; Path=/; Max-Age=3600; HttpOnly"], agora), { cookie: "JSESSIONID=c; XSRF=b", ate: agora + 3600e3 });
  assert.equal(cookieRenovado(null, ["SESSION=x; Expires=Thu, 29 Oct 2026 18:00:00 GMT"], agora)?.ate, Date.UTC(2026, 9, 29, 18));
  assert.equal(cookieRenovado("SESSION=x", ["SESSION=; Max-Age=0"], agora), null, "Ágora apagou o cookie");
});
