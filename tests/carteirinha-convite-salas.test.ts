import assert from "node:assert/strict";
import test from "node:test";
import { interessadosNovos, textoChegadaHoje, textoInteressadosNovos } from "../src/lib/aberturas/recepcao-interessados";
import { agendaPorSala, chaveDaSala } from "../src/lib/agenda-salas";
import type { ItemCalendario } from "../src/lib/calendario-filial";
import { codigoDaCarteirinha, codigoDeConvite, lerCodigoDaCarteirinha, lerCodigoDeConvite } from "../src/lib/carteirinha";
import { somarDias, textoLembreteVoluntariado, textoVoluntariadoDaSemana } from "../src/lib/oportunidades-comum";

const CHAVE = "segredo-de-teste";

test("carteirinha: QR assinado confere; matrícula trocada ou chave errada não", () => {
  const c = codigoDaCarteirinha("21596", CHAVE);
  assert.match(c, /^NAC1\.21596\.[A-Za-z0-9_-]{16}$/);
  assert.equal(lerCodigoDaCarteirinha(c, CHAVE), "21596");
  assert.equal(lerCodigoDaCarteirinha(c.replace("21596", "21597"), CHAVE), null);
  assert.equal(lerCodigoDaCarteirinha(c, "outra"), null);
  assert.equal(lerCodigoDaCarteirinha("https://exemplo.com", CHAVE), null);
});

test("convite: código assinado e diferente do da carteirinha", () => {
  const c = codigoDeConvite("3006", CHAVE);
  assert.equal(lerCodigoDeConvite(c, CHAVE), "3006");
  assert.equal(lerCodigoDeConvite(c.replace("3006", "3007"), CHAVE), null);
  assert.equal(lerCodigoDaCarteirinha(c, CHAVE), null);
});

const item = (id: string, sala: string | null, inicio: string, fim: string | null, camada: ItemCalendario["camada"] = "aula"): ItemCalendario => ({
  id,
  camada,
  titulo: id,
  inicio,
  fim,
  diaInteiro: false,
  detalhe: null,
  publicos: [],
  pessoas: null,
  sala,
});

test("salas: mesmo nome escrito de jeitos diferentes; online e links fora", () => {
  assert.equal(chaveDaSala("Sala Platão"), chaveDaSala("PLATAO"));
  assert.equal(chaveDaSala("Online"), null);
  assert.equal(chaveDaSala("https://meet.google.com/x"), null);
  assert.equal(chaveDaSala(null), null);
});

test("agenda da sala aponta choque de horário só na mesma sala", () => {
  const salas = agendaPorSala([
    item("aula", "PLATAO", "2026-11-10T22:00:00Z", "2026-11-11T00:00:00Z"),
    item("evento", "Sala Platão", "2026-11-10T23:00:00Z", "2026-11-11T01:00:00Z", "evento_filial"),
    item("grupo", "Biblioteca", "2026-11-10T23:00:00Z", null, "reuniao_grupo"),
    item("depois", "Platão", "2026-11-11T01:00:00Z", null),
    item("nacional", "Platão", "2026-11-10T22:00:00Z", null, "evento_externo"),
  ]);
  const platao = salas.find((s) => chaveDaSala(s.sala) === "platao")!;
  assert.equal(platao.itens.length, 3);
  assert.deepEqual(platao.choques.map(([a, b]) => `${a.id}+${b.id}`), ["aula+evento"]);
  assert.equal(salas.find((s) => s.sala === "Biblioteca")!.choques.length, 0);
});

test("interessados novos: só quem não estava na cópia anterior; sem cópia anterior, ninguém", () => {
  const antes = { leads: [{ id: "a", nome: "ANA" }] };
  const depois = { leads: [{ id: "a", nome: "ANA" }, { id: "b", nome: "BRUNO LIMA", aberturaId: "x" }, { id: "c", nome: "CAIO", naoContatar: true }] };
  assert.deepEqual(interessadosNovos(antes, depois), [{ id: "b", nome: "BRUNO LIMA", aberturaId: "x", naoContatar: false }]);
  assert.deepEqual(interessadosNovos(null, depois), []);
});

test("textos da recepção dos interessados", () => {
  assert.deepEqual(textoInteressadosNovos(["BRUNO LIMA"], "Turma de novembro"), { titulo: "Interessado novo · Turma de novembro", corpo: "Bruno. Que tal dar as boas-vindas ainda hoje?" });
  assert.equal(textoChegadaHoje("Turma de novembro", ["ANA", "BRUNO"], "19h30").corpo, "2 interessados esperados às 19h30: Ana e Bruno. Recebam pelo nome.");
});

test("voluntariado da semana e lembrete da véspera", () => {
  assert.equal(somarDias("2026-11-30", 1), "2026-12-01");
  const um = textoVoluntariadoDaSemana([{ titulo: "Recepção do evento", tipo: "pontual", data: "2026-11-14", horario: "19h" }]);
  assert.equal(um.titulo, "Voluntariado esta semana");
  assert.ok(um.corpo.startsWith("Recepção do evento ("));
  assert.equal(textoVoluntariadoDaSemana(Array.from({ length: 4 }, (_, i) => ({ titulo: `T${i}`, tipo: "pontual", data: null, horario: null }))).titulo, "4 tarefas de voluntariado esta semana");
  assert.equal(textoLembreteVoluntariado({ titulo: "Montagem", horario: "8h às 12h" }).titulo, "Amanhã: Montagem");
});
