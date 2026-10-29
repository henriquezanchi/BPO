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
  ["orientacoes", "Orientações e gestão"],
];
