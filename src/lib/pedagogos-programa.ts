import { PROVAS_CONJUNTAS, TEMAS_POR_MATERIA } from "@/lib/temas-curriculo";

/**
 * Programa da formação dos pedagogos (pedido do usuário 2026-10-29): cada pedagogo precisa apresentar todos os
 * temas de todas as disciplinas do programa (N1 = Ética, Sociedade e Filosofia da História) para concluir. A
 * trilha é individual: cada um apresenta o próximo tema que ainda não apresentou, sem ligação com os colegas.
 * Funções puras, usadas no servidor (escala-pedagogos.ts) e na tela.
 */
export type TemaDoPrograma = { sigla: string; disciplina: string; titulo: string; topicos: string[] };
export type Programa = { sigla: string; nome: string; disciplinas: number; temas: TemaDoPrograma[] };

/** N1 junta as três disciplinas; as demais matérias com catálogo entram como programa de uma disciplina só. */
export function programasDosPedagogos(): Programa[] {
  const conjuntas = Object.entries(PROVAS_CONJUNTAS).map(([sigla, c]) => ({
    sigla,
    nome: TEMAS_POR_MATERIA[c.materias[0].sigla]?.curso ?? c.rotuloCurto,
    disciplinas: c.materias.length,
    temas: c.materias.flatMap((m) => (TEMAS_POR_MATERIA[m.sigla]?.temas ?? []).map((t) => ({ sigla: m.sigla, disciplina: m.rotulo, titulo: t.titulo, topicos: t.topicos ?? [] }))),
  }));
  const dentro = new Set(Object.values(PROVAS_CONJUNTAS).flatMap((c) => c.materias.map((m) => m.sigla)));
  const avulsas = Object.entries(TEMAS_POR_MATERIA)
    .filter(([sigla]) => !dentro.has(sigla))
    .map(([sigla, c]) => ({
      sigla,
      nome: c.bloco ? `${c.curso} · ${c.bloco}` : c.curso,
      disciplinas: 1,
      temas: c.temas.map((t) => ({ sigla, disciplina: c.bloco ?? c.curso, titulo: t.titulo, topicos: t.topicos ?? [] })),
    }));
  return [...conjuntas, ...avulsas];
}

export const programaDaSigla = (sigla: string) => programasDosPedagogos().find((p) => p.sigla === sigla) ?? null;

/** Programa a que pertence uma disciplina (ex.: NET → N1). */
export const programaDaDisciplina = (sigla: string | null) => (sigla ? (programasDosPedagogos().find((p) => p.temas.some((t) => t.sigla === sigla)) ?? null) : null);

export const chaveTema = (sigla: string | null, tema: string) => `${sigla ?? ""}|${tema}`;

/** Contam na trilha as apresentações marcadas ou feitas; quem não apresentou (ou teve a data cancelada) repete o tema. */
export const STATUS_NA_TRILHA = ["agendada", "apresentada"];

/** Próximo tema da trilha da pessoa: o primeiro do programa que ela ainda não apresentou nem tem marcado. */
export function proximoTema(programa: Programa, feitos: Iterable<string>) {
  const set = new Set(feitos);
  return programa.temas.find((t) => !set.has(chaveTema(t.sigla, t.titulo))) ?? null;
}

/** Quantos temas do programa estão no conjunto (cada tema conta uma vez). */
export function temasFeitos(programa: Programa, feitos: Iterable<string>) {
  const set = new Set(feitos);
  return programa.temas.filter((t) => set.has(chaveTema(t.sigla, t.titulo))).length;
}
