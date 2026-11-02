import assert from "node:assert/strict";
import test from "node:test";
import { montarDeclaracao, titulo, type DadosDeclaracao } from "../src/lib/declaracoes/texto";

const base: DadosDeclaracao = {
  nome: "MARIA DE TESTE",
  matricula: "12345",
  feminino: true,
  unidade: { nome: "BARRA DO GARÇAS", cnpj: "42640546000157", cidade: "BARRA DO GARÇAS", uf: "MT" },
  ingresso: "2024-09-04",
  reingresso: null,
  nivel: "Nível 2",
  nivelDesde: "2025-04-02",
  formatura: null,
  turma: { nome: "HILARION", dia: "QUARTA", horario: "20:00:00", inicio: "2024-01-22" },
  aulas: [
    { inicio: "2026-08-25", dia: "TERÇA", horario: "18:30:00" },
    { inicio: "2026-09-01", dia: "TERÇA", horario: "18:30:00" },
    { inicio: "2026-09-02", dia: "QUINTA", horario: "20:00:00" },
  ],
  pedagogo: "formacao",
  funcoes: [
    { nome: "COLABORADOR DE EVENTOS", atual: true, inicio: "2025-06-01", termino: null },
    { nome: "SECRETÁRIO DE FILIAL", atual: false, inicio: "2023-01-01", termino: "2024-12-31" },
  ],
  voluntariado: { situacao: "brigadista", corpo: "Brigada Feminina" },
  cursos: [{ nome: "O DISCIPULADO E AS ETAPAS DE FORMAÇÃO DO INDIVÍDUO", data: "2025-07-26" }],
  diretor: { nome: "FULANA DIRETORA", feminino: true },
};
const hoje = new Date("2026-11-02T15:00:00Z");

test("matrícula com unidade, CNPJ, datas, nível e turma, no feminino", () => {
  const [p] = montarDeclaracao(base, ["matricula"], { hoje }).paragrafos;
  assert.match(p, /é aluna regularmente matriculada na Organização Nova Acrópole Barra do Garças, inscrita no CNPJ sob o nº 42\.640\.546\/0001-57, desde 04\/09\/2024\./);
  assert.match(p, /Nível 2, no qual ingressou em 02\/04\/2025, na turma Hilarion \(turma iniciada em 22\/01\/2024\), com aulas às quartas-feiras, às 20h\./);
});

test("instrução, voluntariado e cursos com todas as datas; só as seções pedidas", () => {
  const d = montarDeclaracao(base, ["matricula", "instrucao", "voluntariado", "cursos"], { hoje, finalidade: "comprovação no trabalho.", instrutorDesde: "2025-03-10" });
  const texto = d.paragrafos.join("\n");
  assert.match(texto, /instrutora voluntária da escola desde 10\/03\/2025, com aulas às terças-feiras, às 18h30; e às quintas-feiras, às 20h\. Os dias e horários de aula podem variar de acordo com a necessidade da escola e dos alunos\./);
  assert.doesNotMatch(texto, /Psicologia|Xesotris|Extra/);
  assert.match(texto, /Participa do curso de formação de instrutores/);
  assert.match(texto, /a função de Colaborador de Eventos, desde 01\/06\/2025\./);
  assert.match(texto, /Exerceu anteriormente Secretário de Filial \(de 01\/01\/2023 a 31\/12\/2024\)\./);
  assert.match(texto, /brigadista \(Brigada Feminina\)/);
  assert.match(texto, /“O Discipulado e as Etapas de Formação do Indivíduo”, da Nova Acrópole, realizado em 26\/07\/2025\./);
  assert.match(texto, /a pedido da interessada, para fins de comprovação no trabalho\.$/);
  assert.equal(d.localData, "Barra do Garças/MT, 2 de novembro de 2026.");
  assert.deepEqual(d.assinatura, { nome: "FULANA DIRETORA", cargo: "Diretora" });
  assert.deepEqual(montarDeclaracao(base, ["matricula"], { hoje, assinatura: { nome: "QUEM GEROU", cargo: "Vice-Diretor" } }).assinatura, { nome: "QUEM GEROU", cargo: "Vice-Diretor" });
  const semData = montarDeclaracao(base, ["instrucao"], { hoje }).paragrafos.join("\n");
  assert.match(semData, /instrutora voluntária da escola, com aulas às terças-feiras/);
  assert.doesNotMatch(semData, /25\/08\/2026/);
  const so = montarDeclaracao(base, ["matricula"], { hoje }).paragrafos.join("\n");
  assert.doesNotMatch(so, /instrutora|brigadista|Participou/);
});

test("masculino e títulos", () => {
  const p = montarDeclaracao({ ...base, feminino: false, turma: { ...base.turma!, dia: "SÁBADO", horario: "18:30:00" } }, ["matricula"], { hoje }).paragrafos[0];
  assert.match(p, /é aluno regularmente matriculado/);
  assert.match(p, /aos sábados, às 18h30/);
  assert.equal(titulo("PRÁTICA DE PSICOLOGIA II"), "Prática de Psicologia II");
});
