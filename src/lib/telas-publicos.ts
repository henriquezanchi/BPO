import { EVENT_AUDIENCES } from "@/lib/event-policy";

/**
 * Públicos que uma tela de TV pode mostrar (pedido do usuário 2026-10-24). "Aberto ao público"
 * = eventos do Ulisses; os demais seguem Event.publicos. Sem acesso ao banco: usado também
 * na tela de gestão, no navegador.
 */
export const PUBLICOS_TELA = { aberto_publico: "Aberto ao público", ...EVENT_AUDIENCES } as const;
export type PublicoTela = keyof typeof PUBLICOS_TELA;

export function validarPublicosTela(publicos: string[]): PublicoTela[] {
  const v = [...new Set(publicos)].filter((p): p is PublicoTela => Object.hasOwn(PUBLICOS_TELA, p));
  if (!v.length) throw Error("Escolha ao menos um público para a tela.");
  return v;
}

/** O que a TV intercala com os eventos (pedido do usuário 2026-10-24: "tudo"; Círculo de Amigos/doação saiu em 25/10). */
export const CONTEUDOS_TELA = {
  matriculas: "Matrículas abertas",
  frase: "Frases",
  avisos: "Avisos da filial",
  redes: "Instagram e Acrópole Play",
  programacao: "Programação da semana",
  aniversariantes: "Aniversariantes do mês",
} as const;
export type ConteudoTela = keyof typeof CONTEUDOS_TELA;
export const CONTEUDOS_PADRAO: ConteudoTela[] = ["matriculas", "frase", "avisos"];

/** Aniversariantes nunca numa TV aberta ao público (privacidade). */
export function validarConteudosTela(conteudos: string[], publicos: string[]): ConteudoTela[] {
  const v = [...new Set(conteudos)].filter((c): c is ConteudoTela => Object.hasOwn(CONTEUDOS_TELA, c));
  if (v.includes("aniversariantes") && publicos.includes("aberto_publico"))
    throw Error("Aniversariantes só aparecem em TV interna: desmarque \"Aberto ao público\" ou os aniversariantes.");
  return v;
}

/** Vertical girada: para TVs presas em pé cujo navegador não gira sozinho. */
export const ORIENTACOES_TELA = {
  auto: "Automática (horizontal, ou vertical se a TV já girar a imagem)",
  direita: "Vertical — girar para a direita",
  esquerda: "Vertical — girar para a esquerda",
} as const;
export type OrientacaoTela = keyof typeof ORIENTACOES_TELA;

export function validarOrientacaoTela(o: string): OrientacaoTela {
  return Object.hasOwn(ORIENTACOES_TELA, o) ? (o as OrientacaoTela) : "auto";
}

/** Cartões que a filial escreve; cada tipo entra num conteúdo da TV. */
export const TIPOS_CARTAO = {
  // Matrícula escrita à mão: enquanto a filial não cadastra a turma em Aberturas (que gera o slide sozinha).
  matricula: { rotulo: "Matrículas abertas", conteudo: "matriculas", exemploTitulo: "Curso de Filosofia: nova turma em março", exemploLink: "https://…" },
  aviso: { rotulo: "Aviso", conteudo: "avisos", exemploTitulo: "Feriado de 15 de novembro: sede fechada", exemploLink: "" },
  instagram: { rotulo: "Instagram", conteudo: "redes", exemploTitulo: "Siga a filial no Instagram", exemploLink: "https://instagram.com/…" },
  play: { rotulo: "Acrópole Play", conteudo: "redes", exemploTitulo: "Palestras gravadas no Acrópole Play", exemploLink: "https://…" },
} as const satisfies Record<string, { rotulo: string; conteudo: ConteudoTela; exemploTitulo: string; exemploLink: string }>;
export type TipoCartao = keyof typeof TIPOS_CARTAO;
