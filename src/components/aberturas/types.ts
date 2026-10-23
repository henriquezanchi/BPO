export type JsonRecord = Record<string, unknown>;

export type Pessoa = { id: string; name: string };

export type RegistroAbertura = {
  id: string;
  tipo: string;
  dados: JsonRecord;
  createdAt: string | Date;
};

export type Abertura = {
  id: string;
  mercurioTurmaId?: string | null;
  titulo: string;
  primeiraAula: string;
  diaSemana: number;
  inicioMinuto: number;
  duracaoMinutos: number;
  capacidade: number;
  metaMatriculas: number;
  orcamentoCentavos: number;
  sala: string | null;
  status: string;
  professorIds: string[];
  revisao: number;
  registros: RegistroAbertura[];
};

export type Disponibilidade = {
  id: string;
  professorId: string;
  diaSemana: number;
  inicioMinuto: number;
  fimMinuto: number;
  validaDe: string;
  validaAte: string;
  impedimentos: unknown;
  habilitado: boolean;
};

export type EscalaSecretaria = {
  id: string;
  secretaria: string;
  memberId: string;
  funcao: string;
  diaSemana: number;
  inicioMinuto: number;
  fimMinuto: number;
  validaDe: string;
  validaAte: string;
  confirmado: boolean;
};

export type CalendarioItem = {
  id: string;
  title?: string | null;
  titulo?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  inicio?: string | Date | null;
  fim?: string | Date | null;
  [key: string]: unknown;
};

export type LeadCRM = JsonRecord & { id?: string; name?: string; nome?: string };

export type PainelAberturas = {
  experienciasRede?: Array<{titulo:string;aberturas:number;escolas:number;interessados:number;matriculas:number;conversaoObservada:number;custoRegistradoPorMatriculaCentavos:number|null;sugestao:string;ressalva:string}>;
  member: Pessoa;
  escolas: { id: string; name: string }[];
  schoolId: string;
  aberturas: Abertura[];
  professores: Pessoa[];
  disponibilidades: Disponibilidade[];
  eventos: CalendarioItem[];
  turmas: JsonRecord[];
  escalas: EscalaSecretaria[];
  crm: {
    status: string;
    leads: LeadCRM[];
    matriculas: JsonRecord[];
    baseAtualizadaEm?: string | Date | null;
  };
  aprendizados: JsonRecord[];
  validacaoAvaliacoes?: {
    aberturaId: string;
    janelaDias: number;
    ate: string | null;
    baseAtualizadaEm: string | null;
    coorteConcluida: boolean;
    grupos: {
      versao: string;
      interesse: string;
      adequacao: string;
      avaliados: number;
      matriculados: number;
      semMatriculaNoPeriodo: number;
      pendentes: number;
      acoesRegistradas: number;
      taxaObservada: number | null;
    }[];
    aviso: string | null;
  }[];
  relatorios?: {
    aberturas: {
      aberturaId: string;
      titulo: string;
      primeiraAula?: string | null;
      diaSemana?: number | null;
      mes?: string | null;
      despesas: { previstoCentavos: number; realCentavos: number; amostrasPrevisto: number; amostrasReal: number };
      leads: { denominadorObservado: number | null; matriculadosUnicos: number; conversaoMatricula: number | null };
      matriculas: { confirmadasUnicasMercurio: number; custoRealPorMatriculaCentavos: number | null };
      coortes: Record<string, { presentes: number; ausenciasObservadas: number; avaliados: number; taxaPresenca: number | null }>;
      snapshotsAnteriores: JsonRecord[];
    }[];
    historico: {
      porDiaSemana: JsonRecord[];
      porMes: JsonRecord[];
    };
  };
  config?: {
    capacidadeEscola?: number | null;
    funcoesNecessarias?: string[];
    compartilharAprendizados?: boolean;
    revisao?: number;
  } | null;
  configs?: {
    capacidadeEscola?: number | null;
    funcoesNecessarias?: string[];
    compartilharAprendizados?: boolean;
    revisao?: number;
  } | null;
};

export type ResultadoAcao = { ok: boolean; error?: string; id?: string; [key: string]: unknown };
