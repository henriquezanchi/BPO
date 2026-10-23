/**
 * Motor puro para comparar horários recorrentes de abertura.
 *
 * Todas as datas e horas de entrada são datas civis locais de
 * America/Sao_Paulo: datas no formato YYYY-MM-DD e minutos desde 00:00.
 * Janelas de validade incluem os dois extremos; faixas de horário seguem
 * intervalos semiabertos [início, fim).
 */

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type EstadoAtribuicao = "confirmado" | "previsto";
export type TipoConflitoHorario = "aula" | "evento" | "professor" | "escala";

export interface OpcaoHorario {
  diaSemana: DiaSemana;
  inicioMinuto: number;
  duracaoMinutos: 120;
}

export interface ProfessorHabilitado {
  id: string;
  nome?: string;
}

export interface FaixaLocal {
  data: string;
  inicioMinuto: number;
  fimMinuto: number;
}

/** Uma faixa semanal só informa disponibilidade dentro do intervalo de validade. */
export interface DisponibilidadeDocente {
  professorId: string;
  diaSemana: DiaSemana;
  inicioMinuto: number;
  fimMinuto: number;
  validoDe: string;
  validoAte: string | null;
  impedimentos?: FaixaLocal[];
}

export type ConflitoHorario =
  | (FaixaLocal & { id?: string; tipo: "aula" | "evento"; motivo?: string })
  | (FaixaLocal & { id?: string; tipo: "professor"; professorId: string; motivo?: string })
  | (FaixaLocal & { id?: string; tipo: "escala"; pessoaId: string; motivo?: string });

/** Atribuições são propostas para uma combinação de dia da semana e horário. */
export interface AtribuicaoHorario {
  diaSemana: DiaSemana;
  inicioMinuto: number;
  pessoaId: string;
  funcao: string;
  estado: EstadoAtribuicao;
}

export interface OcupacaoHorario {
  diaSemana: DiaSemana;
  inicioMinuto: number;
  ocupados: number;
  capacidade?: number | null;
}

export interface LeadsHorario {
  diaSemana: DiaSemana;
  inicioMinuto: number;
  amostra: number;
  confirmados: number;
  previstos: number;
}

export interface AmostraHistorica {
  amostra: number;
  matriculas: number;
  leads: number;
  investimentoCentavos: number;
}

export interface HistoricoAbertura {
  /** Agregado para a abertura/curso que está sendo planejado. */
  abertura?: AmostraHistorica;
  /** Chaves são dias da semana 0 (domingo) a 6 (sábado). */
  porDiaSemana?: Partial<Record<DiaSemana, AmostraHistorica>>;
  /** Chaves são meses locais no formato YYYY-MM. */
  porMes?: Record<string, AmostraHistorica>;
}

export interface CompararHorariosInput {
  janelaInicio: string;
  janelaFim: string;
  opcoes: OpcaoHorario[];
  professoresHabilitados: ProfessorHabilitado[];
  disponibilidadesDocentes?: DisponibilidadeDocente[];
  conflitos?: ConflitoHorario[];
  atribuicoes?: AtribuicaoHorario[];
  ocupacaoPorHorario?: OcupacaoHorario[];
  historico?: HistoricoAbertura;
  leads?: LeadsHorario[];
}

export type EstadoDisponibilidade = "disponivel" | "indisponivel" | "desconhecido";
export type SituacaoOpcao = "viavel" | "impedido" | "pendente";

export interface MotivoPlanejamento {
  codigo: string;
  descricao: string;
  data?: string;
  pessoaId?: string;
  conflitoId?: string;
}

export interface IndicadorHistorico extends AmostraHistorica {
  situacao: "com_amostra" | "insuficiente";
}

export interface IndicadoresHorario {
  docentes: {
    titularesNecessarios: 2;
    titularesConfirmados: string[];
    titularesPrevistos: string[];
    titularesDisponiveis: string[];
    suplentesConfirmados: string[];
    suplentesPrevistos: string[];
    suplentesDisponiveis: string[];
    disponibilidade: EstadoDisponibilidade;
  };
  ocupacao: {
    situacao: "conhecida" | "desconhecida";
    ocupados: number | null;
    capacidade: number | null;
    vagas: number | null;
    percentualOcupado: number | null;
  };
  leads: {
    situacao: "conhecida" | "desconhecida";
    amostra: number | null;
    confirmados: number | null;
    previstos: number | null;
  };
  historico: {
    abertura: IndicadorHistorico | null;
    diaSemana: IndicadorHistorico | null;
    meses: Array<{ mes: string; indicador: IndicadorHistorico | null }>;
  };
  voluntarios: {
    confirmados: Array<{ pessoaId: string; funcao: string }>;
    previstos: Array<{ pessoaId: string; funcao: string }>;
  };
}

export interface HorarioAvaliado extends OpcaoHorario {
  fimMinuto: number;
  ocorrencias: string[];
  situacao: SituacaoOpcao;
  motivos: {
    impedimentos: MotivoPlanejamento[];
    pendencias: MotivoPlanejamento[];
  };
  indicadores: IndicadoresHorario;
}

export interface ResultadoComparacao {
  fusoHorario: "America/Sao_Paulo";
  janela: { inicio: string; fim: string };
  criteriosOrdenacao: string[];
  /** Todas as opções na ordem recebida. */
  opcoes: HorarioAvaliado[];
  /** Somente opções viáveis, ordenadas por evidências explícitas. */
  viaveis: HorarioAvaliado[];
}

const DIA_EM_MINUTOS = 24 * 60;
const DURACAO_FIXA = 120;
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const ZONA = "America/Sao_Paulo" as const;

interface DataPartes {
  ano: number;
  mes: number;
  dia: number;
}

interface EstadoDocenteData {
  estado: EstadoDisponibilidade;
}

function validarInteiro(valor: number, nome: string, minimo = 0): void {
  if (!Number.isInteger(valor) || valor < minimo) {
    throw new RangeError(`${nome} deve ser um inteiro maior ou igual a ${minimo}.`);
  }
}

function partesData(data: string, nome: string): DataPartes {
  if (!FORMATO_DATA.test(data)) throw new TypeError(`${nome} deve usar o formato YYYY-MM-DD.`);
  const [ano, mes, dia] = data.split("-").map(Number);
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  if (teste.getUTCFullYear() !== ano || teste.getUTCMonth() + 1 !== mes || teste.getUTCDate() !== dia) {
    throw new RangeError(`${nome} não é uma data válida.`);
  }
  return { ano, mes, dia };
}

function dataIso({ ano, mes, dia }: DataPartes): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function somarDias(data: string, dias: number): string {
  const { ano, mes, dia } = partesData(data, "data");
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return dataIso({ ano: resultado.getUTCFullYear(), mes: resultado.getUTCMonth() + 1, dia: resultado.getUTCDate() });
}

function diaDaSemana(data: string): DiaSemana {
  const { ano, mes, dia } = partesData(data, "data");
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay() as DiaSemana;
}

function mesDaData(data: string): string {
  return data.slice(0, 7);
}

function validarFaixa(inicio: number, fim: number, nome: string, permitirFimDoDia = true): void {
  validarInteiro(inicio, `${nome}.inicioMinuto`);
  validarInteiro(fim, `${nome}.fimMinuto`, 1);
  if (inicio >= DIA_EM_MINUTOS || fim > DIA_EM_MINUTOS || (!permitirFimDoDia && fim === DIA_EM_MINUTOS) || inicio >= fim) {
    throw new RangeError(`${nome} deve ser um intervalo local válido dentro do mesmo dia.`);
  }
}

function sobrepoe(inicioA: number, fimA: number, inicioB: number, fimB: number): boolean {
  return inicioA < fimB && inicioB < fimA;
}

function adicionarMotivo(
  lista: MotivoPlanejamento[],
  motivo: MotivoPlanejamento,
): void {
  const chave = [motivo.codigo, motivo.data ?? "", motivo.pessoaId ?? "", motivo.conflitoId ?? ""].join("|");
  if (!lista.some((item) => [item.codigo, item.data ?? "", item.pessoaId ?? "", item.conflitoId ?? ""].join("|") === chave)) {
    lista.push(motivo);
  }
}

function validarInput(input: CompararHorariosInput): { inicio: string; fim: string } {
  partesData(input.janelaInicio, "janelaInicio");
  partesData(input.janelaFim, "janelaFim");
  if (input.janelaInicio > input.janelaFim) throw new RangeError("janelaInicio deve ser anterior ou igual a janelaFim.");

  for (const professor of input.professoresHabilitados) {
    if (!professor.id.trim()) throw new TypeError("Professores habilitados precisam de um id.");
  }

  for (const opcao of input.opcoes) {
    if (!Number.isInteger(opcao.diaSemana) || opcao.diaSemana < 0 || opcao.diaSemana > 6) {
      throw new RangeError("opcao.diaSemana deve estar entre 0 (domingo) e 6 (sábado).");
    }
    if (!Number.isInteger(opcao.inicioMinuto) || opcao.inicioMinuto < 0 || opcao.inicioMinuto > 1320) {
      throw new RangeError("opcao.inicioMinuto deve estar entre 0 e 1320.");
    }
    if (opcao.duracaoMinutos !== DURACAO_FIXA) {
      throw new RangeError("A duração de cada opção deve ser de 120 minutos.");
    }
  }

  for (const disponibilidade of input.disponibilidadesDocentes ?? []) {
    partesData(disponibilidade.validoDe, "disponibilidade.validoDe");
    if (disponibilidade.validoAte !== null) partesData(disponibilidade.validoAte, "disponibilidade.validoAte");
    if (disponibilidade.validoAte !== null && disponibilidade.validoDe > disponibilidade.validoAte) {
      throw new RangeError("disponibilidade.validoDe deve ser anterior ou igual a validoAte.");
    }
    validarFaixa(disponibilidade.inicioMinuto, disponibilidade.fimMinuto, "disponibilidade");
    for (const impedimento of disponibilidade.impedimentos ?? []) {
      partesData(impedimento.data, "impedimento.data");
      validarFaixa(impedimento.inicioMinuto, impedimento.fimMinuto, "impedimento");
    }
  }

  for (const conflito of input.conflitos ?? []) {
    partesData(conflito.data, "conflito.data");
    validarFaixa(conflito.inicioMinuto, conflito.fimMinuto, "conflito");
  }

  for (const atribuicao of input.atribuicoes ?? []) {
    if (!Number.isInteger(atribuicao.diaSemana) || atribuicao.diaSemana < 0 || atribuicao.diaSemana > 6) {
      throw new RangeError("atribuicao.diaSemana deve estar entre 0 e 6.");
    }
    validarInteiro(atribuicao.inicioMinuto, "atribuicao.inicioMinuto");
    if (atribuicao.inicioMinuto > 1320) throw new RangeError("atribuicao.inicioMinuto deve estar entre 0 e 1320.");
    if (!atribuicao.pessoaId.trim() || !atribuicao.funcao.trim()) throw new TypeError("Atribuições precisam de pessoaId e funcao.");
    if (atribuicao.estado !== "confirmado" && atribuicao.estado !== "previsto") throw new TypeError("atribuicao.estado inválido.");
  }

  for (const ocupacao of input.ocupacaoPorHorario ?? []) {
    if (!Number.isInteger(ocupacao.diaSemana) || ocupacao.diaSemana < 0 || ocupacao.diaSemana > 6) throw new RangeError("ocupacao.diaSemana deve estar entre 0 e 6.");
    validarInteiro(ocupacao.inicioMinuto, "ocupacao.inicioMinuto");
    validarInteiro(ocupacao.ocupados, "ocupacao.ocupados");
    if (ocupacao.inicioMinuto > 1320) throw new RangeError("ocupacao.inicioMinuto deve estar entre 0 e 1320.");
    if (ocupacao.capacidade != null) validarInteiro(ocupacao.capacidade, "ocupacao.capacidade");
  }

  for (const lead of input.leads ?? []) {
    if (!Number.isInteger(lead.diaSemana) || lead.diaSemana < 0 || lead.diaSemana > 6) throw new RangeError("lead.diaSemana deve estar entre 0 e 6.");
    validarInteiro(lead.inicioMinuto, "lead.inicioMinuto");
    if (lead.inicioMinuto > 1320) throw new RangeError("lead.inicioMinuto deve estar entre 0 e 1320.");
    validarInteiro(lead.amostra, "lead.amostra");
    validarInteiro(lead.confirmados, "lead.confirmados");
    validarInteiro(lead.previstos, "lead.previstos");
  }

  const indicadoresHistoricos = [
    input.historico?.abertura,
    ...Object.values(input.historico?.porDiaSemana ?? {}),
    ...Object.values(input.historico?.porMes ?? {}),
  ];
  for (const indicador of indicadoresHistoricos) {
    if (!indicador) continue;
    validarInteiro(indicador.amostra, "historico.amostra");
    validarInteiro(indicador.matriculas, "historico.matriculas");
    validarInteiro(indicador.leads, "historico.leads");
    validarInteiro(indicador.investimentoCentavos, "historico.investimentoCentavos");
  }

  return { inicio: input.janelaInicio, fim: input.janelaFim };
}

function ocorrenciasDaOpcao(opcao: OpcaoHorario, inicio: string, fim: string): string[] {
  const ocorrencias: string[] = [];
  let data = inicio;
  while (data <= fim) {
    if (diaDaSemana(data) === opcao.diaSemana) ocorrencias.push(data);
    data = somarDias(data, 1);
  }
  return ocorrencias;
}

function estadoDocenteNaData(
  professorId: string,
  data: string,
  inicio: number,
  fim: number,
  disponibilidades: DisponibilidadeDocente[],
  conflitos: ConflitoHorario[],
): EstadoDocenteData {
  const dia = diaDaSemana(data);
  const validas = disponibilidades.filter((item) =>
    item.professorId === professorId &&
    item.diaSemana === dia &&
    item.validoDe <= data &&
    (item.validoAte === null || data <= item.validoAte),
  );

  if (validas.length === 0) return { estado: "desconhecido" };

  const faixas = validas
    .map((item) => ({ inicio: item.inicioMinuto, fim: item.fimMinuto }))
    .sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);

  let cobertoAte = inicio;
  for (const faixa of faixas) {
    if (faixa.inicio > cobertoAte) break;
    if (faixa.fim > cobertoAte) cobertoAte = faixa.fim;
    if (cobertoAte >= fim) break;
  }
  if (cobertoAte < fim) return { estado: "indisponivel" };

  const bloqueadoPorImpedimento = validas.some((item) =>
    (item.impedimentos ?? []).some((impedimento) =>
      impedimento.data === data && sobrepoe(inicio, fim, impedimento.inicioMinuto, impedimento.fimMinuto),
    ),
  );
  const bloqueadoPorConflito = conflitos.some((conflito) =>
    conflito.data === data &&
    conflito.tipo === "professor" &&
    conflito.professorId === professorId &&
    sobrepoe(inicio, fim, conflito.inicioMinuto, conflito.fimMinuto),
  );
  const bloqueadoPorEscala = conflitos.some((conflito) =>
    conflito.data === data &&
    conflito.tipo === "escala" &&
    conflito.pessoaId === professorId &&
    sobrepoe(inicio, fim, conflito.inicioMinuto, conflito.fimMinuto),
  );

  return { estado: bloqueadoPorImpedimento || bloqueadoPorConflito || bloqueadoPorEscala ? "indisponivel" : "disponivel" };
}

function estadoDocenteNoHorizonte(
  professorId: string,
  ocorrencias: string[],
  inicio: number,
  fim: number,
  disponibilidades: DisponibilidadeDocente[],
  conflitos: ConflitoHorario[],
): EstadoDisponibilidade {
  if (ocorrencias.length === 0) return "desconhecido";
  let temDesconhecido = false;
  for (const data of ocorrencias) {
    const estado = estadoDocenteNaData(professorId, data, inicio, fim, disponibilidades, conflitos).estado;
    if (estado === "indisponivel") return "indisponivel";
    if (estado === "desconhecido") temDesconhecido = true;
  }
  return temDesconhecido ? "desconhecido" : "disponivel";
}

function motivoConflito(conflito: ConflitoHorario, data: string): MotivoPlanejamento {
  const nomes: Record<TipoConflitoHorario, string> = {
    aula: "Há uma aula conflitante",
    evento: "Há um evento conflitante",
    professor: "Há um conflito de agenda do professor",
    escala: "Há um conflito de escala para a pessoa",
  };
  return {
    codigo: `conflito_${conflito.tipo}`,
    descricao: conflito.motivo?.trim() || nomes[conflito.tipo],
    data,
    ...(conflito.tipo === "professor" ? { pessoaId: conflito.professorId } : {}),
    ...(conflito.tipo === "escala" ? { pessoaId: conflito.pessoaId } : {}),
    ...(conflito.id ? { conflitoId: conflito.id } : {}),
  };
}

function historicoIndicador(amostra: AmostraHistorica | undefined): IndicadorHistorico | null {
  if (!amostra) return null;
  return {
    ...amostra,
    situacao: amostra.amostra > 0 ? "com_amostra" : "insuficiente",
  };
}

function montarIndicadores(
  input: CompararHorariosInput,
  opcao: OpcaoHorario,
  ocorrencias: string[],
  atribuidas: AtribuicaoHorario[],
  disponiveis: string[],
  suplentesDisponiveis: string[],
  disponibilidade: EstadoDisponibilidade,
): IndicadoresHorario {
  const ocupacao = input.ocupacaoPorHorario?.find((item) =>
    item.diaSemana === opcao.diaSemana && item.inicioMinuto === opcao.inicioMinuto,
  );
  const lead = input.leads?.find((item) =>
    item.diaSemana === opcao.diaSemana && item.inicioMinuto === opcao.inicioMinuto,
  );
  const leadsComAmostra = lead && lead.amostra > 0 ? lead : undefined;
  const titulares = atribuidas.filter((item) => item.funcao === "titular");
  const suplentes = atribuidas.filter((item) => item.funcao === "suplente");
  const voluntarios = atribuidas.filter((item) => item.funcao !== "titular" && item.funcao !== "suplente");

  const meses = [...new Set(ocorrencias.map(mesDaData))].sort();
  return {
    docentes: {
      titularesNecessarios: 2,
      titularesConfirmados: [...new Set(titulares.filter((item) => item.estado === "confirmado").map((item) => item.pessoaId))],
      titularesPrevistos: [...new Set(titulares.filter((item) => item.estado === "previsto").map((item) => item.pessoaId))],
      titularesDisponiveis: disponiveis,
      suplentesConfirmados: [...new Set(suplentes.filter((item) => item.estado === "confirmado").map((item) => item.pessoaId))],
      suplentesPrevistos: [...new Set(suplentes.filter((item) => item.estado === "previsto").map((item) => item.pessoaId))],
      suplentesDisponiveis,
      disponibilidade,
    },
    ocupacao: ocupacao
      ? {
          situacao: "conhecida",
          ocupados: ocupacao.ocupados,
          capacidade: ocupacao.capacidade ?? null,
          vagas: ocupacao.capacidade == null ? null : Math.max(0, ocupacao.capacidade - ocupacao.ocupados),
          percentualOcupado: ocupacao.capacidade == null || ocupacao.capacidade === 0
            ? null
            : Math.round((ocupacao.ocupados / ocupacao.capacidade) * 10000) / 100,
        }
      : { situacao: "desconhecida", ocupados: null, capacidade: null, vagas: null, percentualOcupado: null },
    leads: leadsComAmostra
      ? { situacao: "conhecida", amostra: leadsComAmostra.amostra, confirmados: leadsComAmostra.confirmados, previstos: leadsComAmostra.previstos }
      : { situacao: "desconhecida", amostra: null, confirmados: null, previstos: null },
    historico: {
      abertura: historicoIndicador(input.historico?.abertura),
      diaSemana: historicoIndicador(input.historico?.porDiaSemana?.[opcao.diaSemana]),
      meses: meses.map((mes) => ({ mes, indicador: historicoIndicador(input.historico?.porMes?.[mes]) })),
    },
    voluntarios: {
      confirmados: voluntarios.filter((item) => item.estado === "confirmado").map((item) => ({ pessoaId: item.pessoaId, funcao: item.funcao })),
      previstos: voluntarios.filter((item) => item.estado === "previsto").map((item) => ({ pessoaId: item.pessoaId, funcao: item.funcao })),
    },
  };
}

function avaliarOpcao(input: CompararHorariosInput, opcao: OpcaoHorario, janela: { inicio: string; fim: string }): HorarioAvaliado {
  const fimMinuto = opcao.inicioMinuto + DURACAO_FIXA;
  const ocorrencias = ocorrenciasDaOpcao(opcao, janela.inicio, janela.fim);
  const impedimentos: MotivoPlanejamento[] = [];
  const pendencias: MotivoPlanejamento[] = [];
  const atribuidas = (input.atribuicoes ?? []).filter((item) =>
    item.diaSemana === opcao.diaSemana && item.inicioMinuto === opcao.inicioMinuto,
  );
  const professorIds = [...new Set((input.professoresHabilitados ?? []).map((professor) => professor.id))];
  const disponibilidadePorProfessor = new Map<string, EstadoDisponibilidade>();

  if (ocorrencias.length === 0) {
    adicionarMotivo(impedimentos, {
      codigo: "sem_ocorrencias",
      descricao: "O horário não ocorre dentro da janela escolhida.",
    });
  }

  for (const data of ocorrencias) {
    for (const conflito of input.conflitos ?? []) {
      if (conflito.data !== data || !sobrepoe(opcao.inicioMinuto, fimMinuto, conflito.inicioMinuto, conflito.fimMinuto)) continue;
      if (conflito.tipo === "aula" || conflito.tipo === "evento") {
        adicionarMotivo(impedimentos, motivoConflito(conflito, data));
      }
    }
  }

  for (const professorId of professorIds) {
    disponibilidadePorProfessor.set(
      professorId,
      estadoDocenteNoHorizonte(professorId, ocorrencias, opcao.inicioMinuto, fimMinuto, input.disponibilidadesDocentes ?? [], input.conflitos ?? []),
    );
  }

  const titularesAtribuidos = atribuidas.filter((item) => item.funcao === "titular");
  const idsAtribuidos = new Set<string>();
  for (const atribuicao of atribuidas) {
    if (idsAtribuidos.has(atribuicao.pessoaId)) {
      adicionarMotivo(impedimentos, {
        codigo: "pessoa_em_duas_funcoes",
        descricao: "A mesma pessoa foi atribuída a mais de uma função neste horário.",
        pessoaId: atribuicao.pessoaId,
      });
    }
    idsAtribuidos.add(atribuicao.pessoaId);
  }

  for (const atribuicao of atribuidas) {
    const eProfessor = atribuicao.funcao === "titular" || atribuicao.funcao === "suplente";
    if (eProfessor && !professorIds.includes(atribuicao.pessoaId)) {
      adicionarMotivo(impedimentos, {
        codigo: "professor_nao_habilitado",
        descricao: "A pessoa reservada como docente não está na lista de professores habilitados.",
        pessoaId: atribuicao.pessoaId,
      });
      continue;
    }

    if (eProfessor) {
      const estado = disponibilidadePorProfessor.get(atribuicao.pessoaId) ?? "desconhecido";
      if (estado === "indisponivel") {
        adicionarMotivo(impedimentos, {
          codigo: "docente_indisponivel",
          descricao: "O docente reservado tem indisponibilidade ou conflito em uma ou mais ocorrências.",
          pessoaId: atribuicao.pessoaId,
        });
      } else if (estado === "desconhecido") {
        adicionarMotivo(pendencias, {
          codigo: "disponibilidade_docente_desconhecida",
          descricao: "Falta disponibilidade explícita do docente para todas as ocorrências.",
          pessoaId: atribuicao.pessoaId,
        });
      }
    }

    for (const data of ocorrencias) {
      const conflitoEscala = (input.conflitos ?? []).find((conflito) =>
        conflito.tipo === "escala" && conflito.pessoaId === atribuicao.pessoaId && conflito.data === data &&
        sobrepoe(opcao.inicioMinuto, fimMinuto, conflito.inicioMinuto, conflito.fimMinuto),
      );
      if (conflitoEscala) adicionarMotivo(impedimentos, motivoConflito(conflitoEscala, data));
    }
  }

  const idsTitularesConfirmados = new Set(titularesAtribuidos.filter((item) => item.estado === "confirmado").map((item) => item.pessoaId));
  if (idsTitularesConfirmados.size < 2) {
    adicionarMotivo(pendencias, {
      codigo: "titulares_confirmados_insuficientes",
      descricao: `São necessários 2 titulares confirmados; há ${idsTitularesConfirmados.size}.`,
    });
  }

  if (professorIds.length === 0) {
    adicionarMotivo(pendencias, {
      codigo: "professores_habilitados_desconhecidos",
      descricao: "Não há dados de professores habilitados para avaliar a equipe.",
    });
  }

  const estados = [...disponibilidadePorProfessor.values()];
  const disponibilidadeGeral: EstadoDisponibilidade =
    estados.some((estado) => estado === "disponivel") ? "disponivel" :
      estados.some((estado) => estado === "desconhecido") || estados.length === 0 ? "desconhecido" : "indisponivel";
  const titularesDisponiveis = professorIds.filter((id) => disponibilidadePorProfessor.get(id) === "disponivel");
  const idsTitulares = new Set(titularesAtribuidos.map((item) => item.pessoaId));
  const suplentesDisponiveis = professorIds.filter((id) =>
    !idsTitulares.has(id) && disponibilidadePorProfessor.get(id) === "disponivel",
  );

  const indicadores = montarIndicadores(
    input,
    opcao,
    ocorrencias,
    atribuidas,
    titularesDisponiveis,
    suplentesDisponiveis,
    disponibilidadeGeral,
  );
  const situacao: SituacaoOpcao = impedimentos.length > 0 ? "impedido" : pendencias.length > 0 ? "pendente" : "viavel";

  return { ...opcao, fimMinuto, ocorrencias, situacao, motivos: { impedimentos, pendencias }, indicadores };
}

function ordenarViaveis(opcoes: HorarioAvaliado[]): HorarioAvaliado[] {
  let ordenadas = [...opcoes];
  const ordenarConhecidos = (valor: (opcao: HorarioAvaliado) => number | null, direcao: "desc" | "asc") => {
    const conhecidas = ordenadas.filter((opcao) => valor(opcao) !== null);
    const desconhecidas = ordenadas.filter((opcao) => valor(opcao) === null);
    conhecidas.sort((a, b) => {
      const diferenca = (valor(a) as number) - (valor(b) as number);
      return direcao === "desc" ? -diferenca : diferenca;
    });
    ordenadas = [...conhecidas, ...desconhecidas];
  };

  ordenarConhecidos((opcao) => opcao.indicadores.leads.situacao === "conhecida" ? opcao.indicadores.leads.confirmados : null, "desc");
  ordenarConhecidos((opcao) => opcao.indicadores.ocupacao.capacidade != null && opcao.indicadores.ocupacao.capacidade > 0
    ? opcao.indicadores.ocupacao.percentualOcupado
    : null, "asc");
  ordenarConhecidos((opcao) => {
    const historico = opcao.indicadores.historico.diaSemana;
    return historico && historico.amostra > 0 ? historico.leads : null;
  }, "desc");
  return ordenadas;
}

/** Avalia todas as ocorrências semanais de cada horário na janela local. */
export function compararHorarios(input: CompararHorariosInput): ResultadoComparacao {
  const janela = validarInput(input);
  const opcoes = input.opcoes.map((opcao) => avaliarOpcao(input, opcao, janela));
  const viaveis = ordenarViaveis(opcoes.filter((opcao) => opcao.situacao === "viavel"));

  return {
    fusoHorario: ZONA,
    janela: { inicio: janela.inicio, fim: janela.fim },
    criteriosOrdenacao: [
      "Leads confirmados conhecidos, do maior para o menor; horários sem amostra ficam depois dos conhecidos.",
      "Ocupação percentual conhecida, da menor para a maior; sem capacidade informada não ordena este critério.",
      "Leads históricos por dia da semana, do maior para o menor, apenas quando a amostra é maior que zero.",
      "Empates e indicadores desconhecidos preservam a ordem de entrada.",
    ],
    opcoes,
    viaveis,
  };
}
