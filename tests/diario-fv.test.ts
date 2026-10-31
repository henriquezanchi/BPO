import assert from "node:assert/strict";
import test from "node:test";
import {
  bastiaoDaTarefa,
  constanciaDasPraticas,
  estatisticasDoCiclo,
  faixaDeFrequencia,
  minutosDe,
  minutosDeAula,
  nivelDaTarefa,
  pareceLeitura,
  perguntasDoDia,
  proximaCartaSugerida,
  textoDoItem,
  textoDoRelatorioMensal,
  type DiaDoCiclo,
} from "../src/lib/fv/comum";
import { historicoDaCarta } from "../src/lib/fv/historico-carta";

test("perguntas do dia seguem o calendário fixo (2026-11-03 é terça)", () => {
  const cal = { aulaRegularDia: "2", reuniaoRaioDia: "4", aulaMinistradaDias: ["2", "5"], dataCrm: "2026-11-03", dataAulaEd: "2026-11-10" };
  assert.deepEqual(perguntasDoDia(cal, "2026-11-03"), ["aulaRegular", "aulaMinistrada", "crm"]);
  assert.deepEqual(perguntasDoDia(cal, "2026-11-05"), ["reuniaoRaio"]);
  assert.deepEqual(perguntasDoDia({}, "2026-11-03"), []);
});

test("horas de aula vêm do calendário quando a presença é Sim", () => {
  const cal = { aulaRegularHora: "19:30", aulaRegularFim: "21:30", aulaMinistradaTempos: { "2": { inicio: "18:00", fim: "19:15" } } };
  assert.deepEqual(minutosDeAula(cal, "2026-11-03", { aulaRegular: "Sim", aulaMinistrada: "Sim" }), { assistida: 120, ministrada: 75 });
  assert.deepEqual(minutosDeAula(cal, "2026-11-03", { aulaRegular: "Não" }), { assistida: 0, ministrada: 0 });
  assert.equal(minutosDe("01:30"), 90);
  assert.equal(minutosDe("00:00"), null);
  assert.equal(minutosDe("abc"), null);
});

test("próxima Carta: 3 meses depois da última, no mesmo dia", () => {
  assert.equal(proximaCartaSugerida("2026-10-31"), "2027-01-31");
  assert.equal(proximaCartaSugerida("2026-11-15"), "2027-02-15");
});

test("tarefas do GDVE: cor do contador e leitura detectada", () => {
  assert.equal(nivelDaTarefa(0, 3), "zero");
  assert.equal(nivelDaTarefa(1, 3), "pouco");
  assert.equal(nivelDaTarefa(2, 3), "metade");
  assert.equal(nivelDaTarefa(3, 3), "feito");
  assert.ok(pareceLeitura("Ler Bastião 12"));
  assert.ok(!pareceLeitura("Eu sou Discípulo"));
});

test("Bastião pelo número no nome da tarefa", () => {
  const b = bastiaoDaTarefa("Ler Bastião 1");
  assert.ok(b && "unico" in b);
  assert.equal(bastiaoDaTarefa("Eu sou Discípulo"), null);
});

test("item 2 junta as subdivisões", () => {
  assert.equal(textoDoItem({ item2_humor: "leve", item2_ideias: "claras" }, "item2"), "Humor: leve\nIdeias: claras");
  assert.equal(textoDoItem({ item1: "  algo " }, "item1"), "algo");
});

test("constância e faixas de frequência", () => {
  assert.equal(faixaDeFrequencia(28).rotulo, "Sempre");
  assert.equal(faixaDeFrequencia(0).rotulo, "Nunca");
  assert.deepEqual(constanciaDasPraticas(15), { atual: "Às vezes", proximo: "Frequente", faltam: 5 });
  assert.deepEqual(constanciaDasPraticas(30), { atual: "Sempre", proximo: null, faltam: 0 });
});

const dia = (data: string, extra: Partial<DiaDoCiclo> = {}): DiaDoCiclo => ({ data, prologo: false, praticas: [], praticasPessoais: [], presencas: {}, minutosVoluntariado: 0, minutosAulaAssistida: 0, minutosAulaMinistrada: 0, ...extra });

test("estatísticas do ciclo e texto do relatório", () => {
  const e = estatisticasDoCiclo([
    dia("2026-10-30", { prologo: true, praticas: ["tratak", "camara"], praticasPessoais: ["Limpeza da sala", "GN de sexta"], presencas: { aulaRegular: "Sim", crm: "Sim" }, minutosVoluntariado: 90 }),
    dia("2026-10-31", { prologo: true, praticas: ["porta"], minutosAulaAssistida: 120 }),
  ]);
  assert.equal(e.diasDiario, 2);
  assert.equal(e.diasPraticas, 2);
  assert.equal(e.totalPraticas, 3);
  assert.equal(e.limpeza, 1);
  assert.equal(e.gn, 1);
  assert.equal(e.crm, 1);
  const t = textoDoRelatorioMensal({
    mesAno: "outubro de 2026",
    primeiroNome: "Ana",
    ficha: { unidade: "LAGO SUL", condicao: "GF", mestre: "Maria", ultimoEncontro: "2026-10-01", ultimaCarta: null },
    e,
    form: { outrasCrm: "", bastioesLidos: "", propaganda: ["Contato Pessoal"], contribuicao: "", doacao: "", secretariaAtuacao: "", secretariaReuniao: "", secretariaMembros: "", pontosPositivos: "", desafioCrescimento: "" },
    livroAtual: null,
  });
  assert.match(t, /^RELATÓRIO MENSAL - OUTUBRO DE 2026/);
  assert.match(t, /Data do último encontro: 01\/10\/2026/);
  assert.match(t, /Horas Voluntariado Totais: 1h 30m/);
  assert.match(t, /Envolvimento propaganda: Contato Pessoal/);
});

test("Histórico da Carta: nada sem respostas; com respostas, por item", () => {
  const base = { ultimaCarta: "2026-10-20", mestre: "Maria", hoje: "2026-10-31" };
  assert.equal(historicoDaCarta({ ...base, dias: [] }), null);
  const r = historicoDaCarta({
    ...base,
    dias: [
      { data: "2026-10-21", itens: { item1: "Primeiro passo" }, temPratica: true, minutosVoluntariado: 60, minutosAulaAssistida: 0, minutosAulaMinistrada: 0 },
      { data: "2026-10-19", itens: { item1: "Antes da última Carta" }, temPratica: false, minutosVoluntariado: 0, minutosAulaAssistida: 0, minutosAulaMinistrada: 0 },
    ],
  });
  assert.ok(r);
  assert.equal(r.inicio, "2026-10-21");
  assert.match(r.texto, /HISTÓRICO DA CARTA DE DEGRAU/);
  assert.match(r.texto, /Para: Maria/);
  assert.match(r.texto, /Primeiro passo/);
  assert.doesNotMatch(r.texto, /Antes da última Carta/);
});
