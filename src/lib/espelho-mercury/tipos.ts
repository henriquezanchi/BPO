/**
 * Espelho Mercury → Mercúrio antigo (pedido do usuário 04/11/2026): enquanto BGA usa o Mercúrio novo e as outras
 * escolas e os dirigentes ainda leem o antigo, tudo o que for lançado no novo precisa aparecer no antigo. O novo é
 * sempre a fonte da verdade. Os dois lados são lidos e reduzidos aos formatos abaixo; comparar.ts gera as ações.
 * Plano: docs/PLANO-ESPELHO-MERCURY-MERCURIO.md. Procedimentos manuais: docs/ESPELHO-MERCURIO-PROCEDIMENTOS.md.
 */

/** Data sempre "AAAA-MM-DD"; valores em reais (número). */
export type ReciboNovo = { id: string; numero: string; data: string; valor: number; descricao: string | null; ativo: boolean };
export type MesPagoNovo = { ano: number; mes: number; valor: number; pagoEm: string };

export type PessoaNovo = {
  matricula: string;
  nome: string;
  ativo: boolean;
  ingresso: string | null;
  nivel: string | null; // código ("N2", "CA"...)
  turma: string | null;
  inativacao: { em: string | null; motivo: string | null } | null;
  /** null = o dossiê não foi lido (pessoa inativa sem mudança); campos null = o novo não informa, não apagar no antigo. */
  contato: { whatsapp: string | null; whatsappAlt: string | null; email: string | null; cidade: string | null; uf: string | null } | null;
  pessoais: { nascimento: string | null; naturalidade: string | null; profissao: string | null; estadoCivil: string | null; escolaridade: string | null; rg: string | null; cpf: string | null } | null;
  composicao: { rotulo: string; valor: number }[] | null;
  recibos: ReciboNovo[];
  mesesPagos: MesPagoNovo[];
};

export type TurmaNovo = { nome: string; nivel: string | null; diaSemana: number; hora: string; ativa: boolean };
export type MovimentoNovo = { ano: number; mes: number; linhas: { rubrica: string; tipo: "INCOME" | "EXPENSE" | string; entradas: number; saidas: number }[] };
export type CargoNovo = { matricula: string | null; nome: string; cargo: string };

export type LadoNovo = { pessoas: PessoaNovo[]; turmas: TurmaNovo[]; movimentos: MovimentoNovo[]; cargos: CargoNovo[] };

export type PessoaAntigo = {
  matricula: string;
  nome: string;
  unidade: string;
  situacao: string; // "ATI", "INA"...
  ingresso: string | null;
  nivel: string | null;
  turma: string | null;
  contato: { whatsapp: string; whatsappAlt: string; email: string; cidade: string; uf: string };
  pessoais: { nascimento: string | null; naturalidade: string; profissao: string; estadoCivil: string; escolaridade: string; rg: string; cpf: string };
  composicao: { grupo: string; rotulo: string; valor: number }[];
};
export type ReciboAntigo = { id: string; matricula: string; data: string; valor: number; cancelado: boolean };

export type LadoAntigo = {
  unidade: string;
  pessoas: PessoaAntigo[];
  /** Cadastros com a matrícula de alguém do novo que não está nesta unidade (para achar colisão de número). */
  outrasUnidades: { matricula: string; nome: string; unidade: string; situacao: string }[];
  recibos: ReciboAntigo[];
  turmas: { nome: string; nivel: string | null }[];
  /** Matrículas com função atual (dirigente_funcoes) na unidade. */
  comFuncao: Set<string>;
  /** Catálogo de produtos (pro_cod → descrição) para achar o item da composição pelo nome. */
  produtos: { cod: string; descricao: string }[];
};

export type TipoAcao =
  | "incluir_aluno"
  | "conflito_matricula"
  | "ausente_no_novo"
  | "inativar"
  | "reativar"
  | "alterar_nivel"
  | "alterar_turma"
  | "alterar_ingresso"
  | "atualizar_contato"
  | "atualizar_dados_pessoais"
  | "incluir_item_composicao"
  | "excluir_item_composicao"
  | "editar_valor_composicao"
  | "composicao_sem_correspondencia"
  | "lancar_contribuicao"
  | "lancar_recibo_avulso"
  | "cancelar_recibo"
  | "criar_turma"
  | "lancar_movimento_mes"
  | "conferir_funcoes";

export type AreaEspelho = "escolastica" | "economia";

export type Acao = {
  tipo: TipoAcao;
  /** Identifica a ação entre rodadas: a mesma diferença gera a mesma chave (e não vira item novo). */
  chave: string;
  matricula: string | null;
  nome: string | null;
  area: AreaEspelho;
  resumo: string;
  /** O que lançar no antigo, campo a campo (vai para a tela e para o passo a passo manual). */
  dados: Record<string, string>;
  /** O robô sabe fazer (com o payload abaixo). Sem robô, fica como tarefa manual. */
  robo: { tipo: TipoRobo; payload: Record<string, unknown> } | null;
  /** Não faz sozinho nem com aprovação em lote: precisa de alguém olhar (dinheiro divergente, colisão, ausência). */
  revisao: boolean;
};

export type TipoRobo = "contato" | "pessoais" | "incluir_composicao" | "excluir_composicao" | "editar_composicao" | "contribuicao";
