export type AbaEscolastica =
  | readonly [id: string, rotulo: string]
  | readonly [id: string, rotulo: string, href: string];

/** Abas da Escolástica — a Avaliação dos instrutores fica dentro dela. */
export const ABAS_ESCOLASTICA: readonly AbaEscolastica[] = [
  ["pendencias", "Pendências e solicitações"],
  ["membros", "Membros"],
  ["avaliacao", "Avaliação dos instrutores", "/escolastica/avaliacao"],
  ["orientacoes", "Orientações e gestão"],
];
