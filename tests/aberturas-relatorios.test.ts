import assert from "node:assert/strict";
import test from "node:test";
import {
  agregarAprendizadosRede,
  gerarRelatorioAbertura,
  gerarRelatoriosAberturas,
  type AberturaRelatorioInput,
} from "../src/lib/aberturas/relatorios";

const registro = (tipo: string, dados: unknown, createdAt = "2026-10-01T12:00:00.000Z") => ({ tipo, dados, createdAt });

test("separa gasto previsto do real e calcula custo por matrícula Mercúrio única confirmada", () => {
  const report = gerarRelatorioAbertura({
    id: "a1",
    titulo: "Curso teste",
    primeiraAula: "2026-10-05T22:00:00.000Z",
    diaSemana: 1,
    registros: [
      registro("despesa", { valor: "12.34", previsto: false }),
      registro("despesa", { valor: "90.00", valorCentavos: 9000, previsto: true }),
      registro("sinal", { leadId: "l1", tipo: "interesse_declarado" }),
      registro("sinal", { leadId: "l1", tipo: "presenca_palestra" }),
      registro("sinal", { leadId: "l2", tipo: "pedido_matricula" }),
      registro("resultado", { status: "matriculado", mercurioId: " 9001 ", leadId: "l1", fonte: "mercurio", confirmadoEm: "2026-10-02T10:00:00Z" }),
      registro("resultado", { status: "matriculado", mercurioId: "9001", leadId: "l1", fonte: "mercurio", confirmadoEm: "2026-10-03T10:00:00Z" }),
      // Sem comprovação da fonte acadêmica, o resultado não entra no custo.
      registro("resultado", { status: "matriculado", mercurioId: "9002" }),
    ],
  }, {
    leads: [{ id: "não é denominador" }, { id: "outro lead global" }],
    acontecimentos: [{ aberturaId: "outra", leadId: "l3" }],
  });

  assert.deepEqual(report.despesas, { previstoCentavos: 9000, realCentavos: 1234, amostrasPrevisto: 1, amostrasReal: 1 });
  assert.equal(report.matriculas.confirmadasUnicasMercurio, 1);
  assert.equal(report.matriculas.custoRealPorMatriculaCentavos, 1234);
  assert.equal(report.leads.denominadorObservado, 2);
  assert.equal(report.leads.matriculadosUnicos, 1);
  assert.equal(report.leads.conversaoMatricula, 0.5);
});

test("coortes contam somente presença e ausência explicitamente observadas", () => {
  const report = gerarRelatorioAbertura({
    id: "a1",
    primeiraAula: "2026-10-05T22:00:00.000Z",
    registros: [
      registro("resultado", { status: "presenca30", mercurioId: "1", presente: true, fonte: "registro_local" }),
      registro("resultado", { status: "presenca30", mercurioId: "2", presente: false, fonte: "registro_local" }),
      registro("resultado", { status: "presenca30", mercurioId: "3", fonte: "registro_local" }),
      registro("resultado", { status: "presenca30", mercurioId: "4", presente: "negado", fonte: "registro_local" }),
      registro("resultado", { status: "presenca30", mercurioId: "7", presente: true, fonte: "registro_local" }),
      registro("resultado", { status: "presenca30", mercurioId: "7", presente: false, fonte: "registro_local" }),
      registro("resultado", { status: "presenca60", mercurioId: "5", presente: true, fonte: "registro_local" }),
      registro("resultado", { status: "presenca90", mercurioId: "6", presente: true, fonte: "mercurio" }),
    ],
  });

  assert.deepEqual(report.coortes.presenca30, { presentes: 1, ausenciasObservadas: 1, avaliados: 2, taxaPresenca: 0.5 });
  assert.deepEqual(report.coortes.presenca60, { presentes: 1, ausenciasObservadas: 0, avaliados: 1, taxaPresenca: 1 });
  assert.deepEqual(report.coortes.presenca90, { presentes: 0, ausenciasObservadas: 0, avaliados: 0, taxaPresenca: null });
});

test("preserva snapshots anteriores e separa médias por dia e mês com amostras", () => {
  const aberturas: AberturaRelatorioInput[] = [
    {
      id: "a1", titulo: "Outubro", primeiraAula: "2026-10-05T22:00:00.000Z", diaSemana: 1,
      registros: [
        registro("despesa", { valorCentavos: 1000, previsto: false }),
        registro("avaliacao", { leadId: "lead-1", avaliadoEm: "2026-10-03T10:00:00Z", interesse: "alto", adequacaoTurma: "adequada" }),
        registro("avaliacao", { leadId: "lead-1", avaliadoEm: "2026-10-04T12:00:00Z", interesse: "médio" }),
        registro("avaliacao", { leadId: "lead-2", avaliadoEm: "2026-10-03T12:00:00Z", interesse: "alto" }),
        registro("resultado", { status: "matriculado", mercurioId: "1", leadId: "lead-1", data: "2026-10-04", fonte: "mercurio", confirmadoEm: "2026-10-04T14:00:00Z" }, "2026-10-04T14:00:00Z"),
      ],
    },
    { id: "a2", titulo: "Outubro 2", primeiraAula: "2026-10-12T22:00:00.000Z", diaSemana: 1, registros: [registro("despesa", { valorCentavos: 3000, previsto: false })] },
    { id: "a3", titulo: "Novembro", primeiraAula: "2026-11-03T22:00:00.000Z", diaSemana: 2, registros: [registro("despesa", { valorCentavos: 5000, previsto: false })] },
  ];

  const result = gerarRelatoriosAberturas(aberturas, {
    matriculas: [
      { aberturaId: "a1", leadId: "lead-2", mercurioId: "2", data: "2026-10-02", ativo: true },
      { aberturaId: "outra", leadId: "lead-3", mercurioId: "3", data: "2026-10-02", ativo: true },
    ],
  });
  assert.equal(result.aberturas[0].snapshotsAnteriores.length, 1);
  assert.equal(result.aberturas[0].snapshotsAnteriores[0].avaliadoEm, "2026-10-03T10:00:00.000Z");
  assert.equal(result.aberturas[0].snapshotsAnteriores[0].resultadoEm, "2026-10-04");
  assert.deepEqual(result.historico.porDiaSemana.map(({ diaSemana, amostras }) => [diaSemana, amostras]), [[1, 2], [2, 1]]);
  assert.equal(result.historico.porDiaSemana[0].gastoRealMedioCentavos, 2000);
  assert.equal(result.historico.porDiaSemana[0].amostrasReal, 2);
  assert.deepEqual(result.historico.porMes.map(({ mes, amostras }) => [mes, amostras]), [["2026-10", 2], ["2026-11", 1]]);
});

test("agrupa mês pelo calendário local da aula", () => {
  const report = gerarRelatorioAbertura({ id: "limite-mes", primeiraAula: "2026-11-01T02:30:00.000Z" });
  assert.equal(report.mes, "2026-10");
});

test("aprendizados de rede exigem opt-in, três aberturas e dez leads e expõem só contagens agregadas", () => {
  const fontes: Parameters<typeof agregarAprendizadosRede>[0] = [
    { schoolId: "school-private-1", compartilharAprendizados: true, aberturas: [{ id: "opening-private-1", registros: [registro("aprendizado", { titulo: "Convite", descricao: "Enviar para ana@example.org, telefone 11987654321, cadastro 12345678901.", compartilhar: true })] }], leadsPorAbertura: { "opening-private-1": ["l1", "l2", "l3", "l4"] } },
    { schoolId: "school-private-2", compartilharAprendizados: true, aberturas: [{ id: "opening-private-2", registros: [registro("aprendizado", { titulo: "Convite", descricao: "Enviar para ana@example.org, telefone 11987654321, cadastro 12345678901.", compartilhar: true })] }], leadsPorAbertura: { "opening-private-2": ["l5", "l6", "l7"] } },
    { schoolId: "school-private-3", compartilharAprendizados: true, aberturas: [{ id: "opening-private-3", registros: [registro("aprendizado", { titulo: "Convite", descricao: "Enviar para ana@example.org, telefone 11987654321, cadastro 12345678901.", compartilhar: true })] }], leadsPorAbertura: { "opening-private-3": ["l8", "l9", "l10"] } },
  ];

  assert.deepEqual(agregarAprendizadosRede([{ ...fontes[0], compartilharAprendizados: false }, ...fontes.slice(1)]), []);
  assert.deepEqual(agregarAprendizadosRede(fontes.slice(0, 2)), []);
  const result = agregarAprendizadosRede(fontes);
  assert.equal(result.length, 1);
  assert.equal(result[0].aberturasAgregadas, 3);
  assert.equal(result[0].leadsAgregados, 10);
  assert.equal(result[0].amostras, 3);
  assert.equal(result[0].representacao, "contagem_agregada_sem_texto");
  assert.ok(!JSON.stringify(result).includes("school-private"));
  assert.ok(!JSON.stringify(result).includes("opening-private"));
  assert.ok(!JSON.stringify(result).includes("ana@example.org"));
  assert.ok(!JSON.stringify(result).includes("11987654321"));
  assert.ok(!JSON.stringify(result).includes("12345678901"));
});

test('validação das avaliações não transforma base incompleta em não matrícula', async()=>{
 const {medirAvaliacoes}=await import('../src/lib/aberturas/relatorios');
 const a={id:'a',primeiraAula:'2026-01-01T22:00:00Z',mercurioTurmaId:'T',status:'concluida',registros:[{tipo:'avaliacao',dados:{leadId:'p',avaliadoEm:'2025-12-01T00:00:00Z',versaoMotor:'1',interesse:{estado:'participar'},adequacaoTurma:{estado:'adequada'}}}]};
 const incompleta=medirAvaliacoes(a,{baseAtualizadaEm:'2026-01-02'},'2026-02-20T00:00:00Z');
 assert.equal(incompleta.grupos[0].pendentes,1);assert.equal(incompleta.grupos[0].semMatriculaNoPeriodo,0);
 const completa=medirAvaliacoes(a,{baseAtualizadaEm:'2026-02-10'},'2026-02-20T00:00:00Z');
 assert.equal(completa.grupos[0].semMatriculaNoPeriodo,1);
 const atualizada=medirAvaliacoes(a,{baseAtualizadaEm:'2026-02-10',matriculas:[{leadId:'p',turmaId:'T',data:'2026-01-01'}]},'2026-02-20T00:00:00Z');
 assert.equal(atualizada.grupos[0].matriculados,1);assert.equal(atualizada.grupos[0].taxaObservada,1);
});


test('prazo de inscrições inclui o último dia e encerra a coorte no prazo configurado', async()=>{
 const {medirAvaliacoes}=await import('../src/lib/aberturas/relatorios');
 const abertura={id:'prazo',primeiraAula:'2026-01-01T22:00:00Z',inscricoesAte:'2026-01-08T02:59:59.999Z',mercurioTurmaId:'T',status:'concluida',registros:[{tipo:'avaliacao',dados:{leadId:'p',avaliadoEm:'2025-12-01T00:00:00Z'}}]};
 const cache={baseAtualizadaEm:'2026-01-09',matriculas:[{leadId:'p',turmaId:'T',data:'2026-01-07'}]};
 const dentro=medirAvaliacoes(abertura,cache,'2026-01-10');
 assert.equal(dentro.ate,abertura.inscricoesAte);assert.equal(dentro.coorteConcluida,true);assert.equal(dentro.grupos[0].matriculados,1);
 const fora=medirAvaliacoes(abertura,{...cache,matriculas:[{leadId:'p',turmaId:'T',data:'2026-01-08'}]},'2026-01-10');
 assert.equal(fora.grupos[0].matriculados,0);assert.equal(fora.grupos[0].semMatriculaNoPeriodo,1);
});

test('prazo de admissão não bloqueia acompanhamento posterior de presença',async()=>{
 const {validarPrazoMatricula}=await import('../src/lib/aberturas/validacao');
 const limite=new Date('2026-01-08T02:59:59.999Z');
 assert.doesNotThrow(()=>validarPrazoMatricula('matriculado','2026-01-07',limite));
 assert.throws(()=>validarPrazoMatricula('matriculado','2026-01-08',limite));
 for(const status of ['presenca30','presenca60','presenca90'])assert.doesNotThrow(()=>validarPrazoMatricula(status,'2026-04-01',limite));
});
