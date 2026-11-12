import { consultarMercurio, sqlTexto } from "./client";

/**
 * Quanto cada fonte do banco de consulta do Mercúrio ("oinabview") está atualizada (12/11/2026).
 *
 * Achado em 12/11/2026: só algumas tabelas são consultas ao vivo do Mercúrio (VIEW); as demais são cópias carregadas uma
 * vez (BASE TABLE), e a maioria parou em 17/10/2026. A composição dos alunos da ENOCH de Barra do Garças, trocada no
 * Mercúrio depois disso, voltava ao valor antigo a cada importação. A data da tabela `atualização` não serve de guia: diz
 * 30/10 enquanto as cópias são de 17/10. Por isso a data de cada cópia vem do próprio information_schema.
 *
 * Usado pela importação (para não sobrescrever o Portal com cópia velha) e pela página de saúde.
 */
export const FONTES_MERCURIO: Record<string, { traz: string; critica?: boolean }> = {
  cadastro: { traz: "Quem está ativo, dados pessoais e de contato, nível, turma, grupo de voluntários", critica: true },
  reciboc: { traz: "Recibos emitidos (pagamentos registrados)", critica: true },
  reciboi: { traz: "Itens de cada recibo (qual mês e qual rubrica foi paga)", critica: true },
  turmas: { traz: "Turmas da filial (dia, horário, sala)" },
  turmas_materias: { traz: "Matérias e instrutores de cada turma" },
  compaluno: { traz: "Composição das contribuições de cada pessoa (rubricas e valores)", critica: true },
  fichas: { traz: "Situação mês a mês da contribuição (em dia, em atraso, isento)", critica: true },
  produtos: { traz: "Nomes das rubricas (o que aparece nos recibos e na composição)" },
  unidades: { traz: "Dados da filial: Chefe de Filial, Sub-Chefe, CNPJ, endereço", critica: true },
  dirigente_funcoes: { traz: "Cargos e funções (secretarias, chefias de BF/BM/CS, quem libera o Portal)", critica: true },
  cursos_integra_participa: { traz: "Cursos de integração que cada pessoa fez (Jornada, declarações)" },
  dirigente_condecoracoes: { traz: "Condecorações de dirigente (Trajetória)" },
  condecoracoes: { traz: "Condecorações (Trajetória)" },
  sig_cursos_integra: { traz: "Catálogo de cursos de integração" },
  sig_materias: { traz: "Catálogo de matérias" },
  sig_minscr: { traz: "Catálogo de meios de inscrição (Visão geral)" },
  sig_motivo_baixa: { traz: "Catálogo de motivos de saída (Visão geral)" },
  sig_niveis: { traz: "Catálogo de níveis (declarações)" },
  sig_dirigente_funcoes: { traz: "Catálogo de cargos" },
  sig_condecoracoes: { traz: "Catálogo de condecorações" },
  sig_dirigente_condecoracoes: { traz: "Catálogo de condecorações de dirigente" },
};

/** Cópia com mais de 2 dias é tratada como desatualizada (a carga prometida era diária). */
export const LIMITE_COPIA_MS = 2 * 24 * 3600_000;

export type FrescorFonte = {
  tabela: string;
  traz: string;
  critica: boolean;
  aoVivo: boolean;
  /** Data da última carga da cópia (null para consulta ao vivo ou tabela sumida). */
  carregadaEm: string | null;
  desatualizada: boolean;
  existe: boolean;
};

let cache: { em: number; fontes: FrescorFonte[] } | null = null;

export async function frescorDasFontes(): Promise<FrescorFonte[]> {
  if (cache && Date.now() - cache.em < 5 * 60_000) return cache.fontes;
  const nomes = Object.keys(FONTES_MERCURIO);
  const linhas = await consultarMercurio(
    `SELECT TABLE_NAME, TABLE_TYPE, CREATE_TIME, UPDATE_TIME FROM information_schema.TABLES WHERE TABLE_SCHEMA='oinabview' AND TABLE_NAME IN (${nomes.map(sqlTexto).join(",")})`,
  );
  const porNome = new Map(linhas.map((l) => [l.TABLE_NAME!, l]));
  const fontes = nomes.map((tabela) => {
    const l = porNome.get(tabela);
    const aoVivo = l?.TABLE_TYPE === "VIEW";
    const bruto = l && !aoVivo ? (l.UPDATE_TIME ?? l.CREATE_TIME) : null;
    // O servidor do Mercúrio grava no horário de Brasília.
    const carregadaEm = bruto ? new Date(`${bruto.replace(" ", "T")}-03:00`).toISOString() : null;
    return {
      tabela,
      traz: FONTES_MERCURIO[tabela].traz,
      critica: !!FONTES_MERCURIO[tabela].critica,
      aoVivo,
      carregadaEm,
      existe: !!l,
      desatualizada: !l || (!aoVivo && (!carregadaEm || Date.now() - Date.parse(carregadaEm) > LIMITE_COPIA_MS)),
    };
  });
  cache = { em: Date.now(), fontes };
  return fontes;
}

/** true se a tabela é cópia velha (ou não deu para saber). Ao vivo = false. */
export async function copiaDesatualizada(tabela: string): Promise<boolean> {
  const f = (await frescorDasFontes().catch(() => [] as FrescorFonte[])).find((x) => x.tabela === tabela);
  return f ? f.desatualizada : true;
}
