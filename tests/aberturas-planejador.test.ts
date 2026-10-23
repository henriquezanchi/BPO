import assert from "node:assert/strict";
import test from "node:test";
import {
  compararHorarios,
  type CompararHorariosInput,
  type DisponibilidadeDocente,
  type OpcaoHorario,
} from "../src/lib/aberturas/planejador";

const professores = [{ id: "p1", nome: "Ana" }, { id: "p2", nome: "Bia" }, { id: "p3", nome: "Caio" }];

function disponibilidade(
  professorId: string,
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  inicioMinuto = 1080,
  fimMinuto = 1200,
  validoDe = "2026-10-01",
  validoAte: string | null = "2026-11-30",
  impedimentos: DisponibilidadeDocente["impedimentos"] = [],
): DisponibilidadeDocente {
  return { professorId, diaSemana, inicioMinuto, fimMinuto, validoDe, validoAte, impedimentos };
}

function opcao(diaSemana: OpcaoHorario["diaSemana"], inicioMinuto = 1080): OpcaoHorario {
  return { diaSemana, inicioMinuto, duracaoMinutos: 120 };
}

function base(overrides: Partial<CompararHorariosInput> = {}): CompararHorariosInput {
  return {
    janelaInicio: "2026-10-05",
    janelaFim: "2026-10-19",
    opcoes: [opcao(1)],
    professoresHabilitados: professores,
    disponibilidadesDocentes: [disponibilidade("p1", 1), disponibilidade("p2", 1), disponibilidade("p3", 1)],
    atribuicoes: [
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p1", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p2", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p3", funcao: "recepcao", estado: "previsto" },
    ],
    ...overrides,
  };
}

test("expande todas as ocorrências locais e trata faixas de conflito como semiabertas", () => {
  const resultado = compararHorarios(base({
    conflitos: [
      // Termina quando o horário começa: não há sobreposição.
      { id: "antes", tipo: "evento", data: "2026-10-05", inicioMinuto: 1020, fimMinuto: 1080 },
      // Começa no mesmo instante em que o horário termina: também não sobrepõe.
      { id: "depois", tipo: "aula", data: "2026-10-12", inicioMinuto: 1200, fimMinuto: 1260 },
      // A terceira segunda-feira do horizonte não deve passar despercebida.
      { id: "durante", tipo: "evento", data: "2026-10-19", inicioMinuto: 1199, fimMinuto: 1220, motivo: "Assembleia" },
    ],
  }));
  const avaliada = resultado.opcoes[0];
  assert.deepEqual(avaliada.ocorrencias, ["2026-10-05", "2026-10-12", "2026-10-19"]);
  assert.equal(avaliada.situacao, "impedido");
  assert.deepEqual(avaliada.motivos.impedimentos.map(({ conflitoId }) => conflitoId), ["durante"]);
  assert.equal(resultado.fusoHorario, "America/Sao_Paulo");
});

test("agenda sem disponibilidade deixa a equipe desconhecida e pendente, sem marcar indisponibilidade", () => {
  const resultado = compararHorarios(base({ disponibilidadesDocentes: [] }));
  const avaliada = resultado.opcoes[0];
  assert.equal(avaliada.situacao, "pendente");
  assert.equal(avaliada.indicadores.docentes.disponibilidade, "desconhecido");
  assert.deepEqual(avaliada.indicadores.docentes.titularesDisponiveis, []);
  assert.ok(avaliada.motivos.pendencias.some(({ codigo }) => codigo === "disponibilidade_docente_desconhecida"));
  assert.deepEqual(avaliada.motivos.impedimentos, []);
  assert.equal(avaliada.indicadores.ocupacao.situacao, "desconhecida");
  assert.equal(avaliada.indicadores.leads.situacao, "desconhecida");
  assert.equal(avaliada.indicadores.historico.diaSemana, null);
});

test("resposta de leads sem amostra continua desconhecida", () => {
  const avaliada = compararHorarios(base({
    leads: [{ diaSemana: 1, inicioMinuto: 1080, amostra: 0, confirmados: 0, previstos: 0 }],
  })).opcoes[0];
  assert.equal(avaliada.indicadores.leads.situacao, "desconhecida");
  assert.equal(avaliada.indicadores.leads.amostra, null);
  assert.equal(avaliada.motivos.impedimentos.length, 0);
  assert.equal(avaliada.motivos.pendencias.length, 0);
});

test("janela explícita, validade e impedimento pontual são avaliados em todas as datas", () => {
  const resultado = compararHorarios(base({
    disponibilidadesDocentes: [
      disponibilidade("p1", 1),
      disponibilidade("p2", 1, 1080, 1200, "2026-10-05", "2026-10-12", [
        { data: "2026-10-12", inicioMinuto: 1190, fimMinuto: 1210 },
      ]),
      disponibilidade("p3", 1),
    ],
  }));
  const avaliada = resultado.opcoes[0];
  assert.equal(avaliada.situacao, "impedido");
  assert.deepEqual(avaliada.ocorrencias, ["2026-10-05", "2026-10-12", "2026-10-19"]);
  assert.ok(avaliada.motivos.impedimentos.some(({ codigo, pessoaId }) => codigo === "docente_indisponivel" && pessoaId === "p2"));
});

test("duas reservas confirmadas de docentes distintos são necessárias; previsões não as substituem", () => {
  const previsto = compararHorarios(base({
    atribuicoes: [
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p1", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p2", funcao: "titular", estado: "previsto" },
    ],
  })).opcoes[0];
  assert.equal(previsto.situacao, "pendente");
  assert.deepEqual(previsto.indicadores.docentes.titularesConfirmados, ["p1"]);
  assert.deepEqual(previsto.indicadores.docentes.titularesPrevistos, ["p2"]);

  const duplicada = compararHorarios(base({
    atribuicoes: [
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p1", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p1", funcao: "recepcao", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p2", funcao: "titular", estado: "confirmado" },
    ],
  })).opcoes[0];
  assert.equal(duplicada.situacao, "impedido");
  assert.ok(duplicada.motivos.impedimentos.some(({ codigo }) => codigo === "pessoa_em_duas_funcoes"));
});

test("mostra ocupação, leads e histórico como indicadores e ordena viáveis com critérios visíveis", () => {
  const resultado = compararHorarios(base({
    opcoes: [opcao(1, 1080), opcao(1, 900), opcao(1, 720)],
    disponibilidadesDocentes: [
      disponibilidade("p1", 1), disponibilidade("p2", 1), disponibilidade("p3", 1),
      disponibilidade("p1", 1, 900, 1020), disponibilidade("p2", 1, 900, 1020), disponibilidade("p3", 1, 900, 1020),
      disponibilidade("p1", 1, 720, 840), disponibilidade("p2", 1, 720, 840), disponibilidade("p3", 1, 720, 840),
    ],
    atribuicoes: [
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p1", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 1080, pessoaId: "p2", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 900, pessoaId: "p1", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 900, pessoaId: "p2", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 720, pessoaId: "p1", funcao: "titular", estado: "confirmado" },
      { diaSemana: 1, inicioMinuto: 720, pessoaId: "p2", funcao: "titular", estado: "confirmado" },
    ],
    ocupacaoPorHorario: [
      { diaSemana: 1, inicioMinuto: 1080, ocupados: 18, capacidade: 20 },
      { diaSemana: 1, inicioMinuto: 900, ocupados: 4, capacidade: 20 },
    ],
    leads: [
      { diaSemana: 1, inicioMinuto: 1080, amostra: 9, confirmados: 2, previstos: 1 },
      { diaSemana: 1, inicioMinuto: 900, amostra: 9, confirmados: 5, previstos: 2 },
    ],
    historico: {
      abertura: { amostra: 0, matriculas: 0, leads: 0, investimentoCentavos: 0 },
      porDiaSemana: { 1: { amostra: 4, matriculas: 12, leads: 7, investimentoCentavos: 12500 } },
      porMes: { "2026-10": { amostra: 2, matriculas: 5, leads: 3, investimentoCentavos: 9000 } },
    },
  }));

  assert.deepEqual(resultado.viaveis.map(({ inicioMinuto }) => inicioMinuto), [900, 1080, 720]);
  const semOcupacao = resultado.opcoes.find(({ inicioMinuto }) => inicioMinuto === 720)!;
  assert.equal(semOcupacao.indicadores.ocupacao.situacao, "desconhecida");
  assert.equal(semOcupacao.indicadores.leads.situacao, "desconhecida");
  assert.equal(semOcupacao.indicadores.historico.abertura?.situacao, "insuficiente");
  assert.deepEqual(semOcupacao.indicadores.historico.meses.map(({ mes }) => mes), ["2026-10"]);
  assert.ok(resultado.criteriosOrdenacao.length >= 3);
});

test("valida duração fixa e formato de data ISO local", () => {
  assert.throws(() => compararHorarios(base({ opcoes: [{ diaSemana: 1, inicioMinuto: 1080, duracaoMinutos: 90 as 120 }] })), /120 minutos/);
  assert.throws(() => compararHorarios(base({ janelaInicio: "2026-02-30" })), /data válida/);
  assert.throws(() => compararHorarios(base({ opcoes: [{ diaSemana: 1, inicioMinuto: 1321, duracaoMinutos: 120 }] })), /entre 0 e 1320/);
});
