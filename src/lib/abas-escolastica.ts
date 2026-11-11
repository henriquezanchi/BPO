export type AbaEscolastica =
  | readonly [id: string, rotulo: string]
  | readonly [id: string, rotulo: string, href: string];

/** Abas da Escolástica — a Avaliação dos instrutores fica dentro dela. */
export const ABAS_ESCOLASTICA: readonly AbaEscolastica[] = [
  ["pendencias", "Pendências e solicitações"],
  ["membros", "Membros"],
  ["avaliacao", "Avaliação dos instrutores", "/escolastica/avaliacao"],
  ["atendimentos", "Atendimentos dos instrutores", "/escolastica/atendimentos"],
  ["pedagogos", "Turmas de pedagogos", "/escolastica/pedagogos"],
  // Só Chefe, Sub-Chefe e administração nacional veem esta aba (ver AbasEscolastica e lib/solicitacoes-pedagogo.ts).
  ["novos-pedagogos", "Novos pedagogos", "/escolastica/novos-pedagogos"],
  ["declaracoes", "Declarações", "/escolastica/declaracoes"],
  ["orientacoes", "Orientações e gestão"],
];
