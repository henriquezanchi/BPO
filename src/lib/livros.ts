/** Situações de um livro na Área de Estudos (2026-10-29); "quero_ler" é o valor padrão antigo da coluna. */
export const SITUACOES_LIVRO = { lendo: "Lendo", quero: "Quero ler", tenho: "Tenho, ainda não li", lido: "Lido" } as const;
export type SituacaoLivro = keyof typeof SITUACOES_LIVRO;
export const ORDEM_LIVROS = Object.keys(SITUACOES_LIVRO) as SituacaoLivro[];
export const situacaoDoLivro = (s: string): SituacaoLivro => (s === "quero_ler" ? "quero" : ORDEM_LIVROS.includes(s as SituacaoLivro) ? (s as SituacaoLivro) : "quero");
