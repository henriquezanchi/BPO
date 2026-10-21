/**
 * Catálogo de temas por matéria (pedido do usuário 2026-10-19/21): as
 * disciplinas e os temas são padrão, então o instrutor escolhe numa lista em
 * vez de digitar (prova, trabalho, leitura). Base também para o currículo dos
 * instrutores (quais temas cada um já deu), ainda por fazer.
 *
 * As chaves são as siglas de matéria do Mercúrio (TurmaMateria.materiaSigla).
 * Fontes: "00 tema do curso.pdf" (N1, Filosofia para Viver, 3 blocos) e a
 * lista de Psicologia 1 a 13 e a apostila da ISO (sumário) enviadas pelo
 * usuário. As demais matérias entram quando o usuário mandar as listas.
 */
/** `titulo` é o que fica gravado; `rotulo`/`grupo` só organizam a lista (prova conjunta). */
export type Tema = { titulo: string; topicos?: string[]; rotulo?: string; grupo?: string };
export type CatalogoMateria = { curso: string; bloco?: string; temas: Tema[] };

export const TEMAS_POR_MATERIA: Record<string, CatalogoMateria> = {
  NET: {
    curso: "Filosofia para Viver (N1)",
    bloco: "Potencializar a ética e os valores",
    temas: [
      { titulo: "1. Filosofia natural", topicos: ["Filosofia ativa: uma forma de vida", "Como reconhecer e desenvolver os valores humanos?"] },
      { titulo: "2. O ser humano e o cosmos", topicos: ["Constituição humana e da natureza", "Teoria de Dharma e Karma na Índia"] },
      { titulo: "3. A sabedoria da Índia", topicos: ["Simbolismo do Bhagavad Gita", "Abordagem do conflito interior"] },
      { titulo: "4. Os mistérios do Tibet", topicos: ["Antigos textos tibetanos: A Voz do Silêncio", "O valor da introspecção e da reflexão"] },
      { titulo: "5. Filosofia budista", topicos: ["A dor como veículo de consciência", "As crises: compreensão e superação"] },
      { titulo: "6. A sabedoria na China", topicos: ["Confúcio e seus ensinamentos", "A ética como marco do coletivo"] },
    ],
  },
  NSC: {
    curso: "Filosofia para Viver (N1)",
    bloco: "Para melhorar as relações humanas",
    temas: [
      { titulo: "1. O desafio de viver na sociedade", topicos: ["A convivência", "Os problemas do mundo e do ser humano atual"] },
      { titulo: "2. Platão", topicos: ["O mito da caverna: chaves de interpretação"] },
      { titulo: "3. Aristóteles", topicos: ["A busca da felicidade"] },
      { titulo: "4. Plotino e a escola neoplatônica", topicos: ["Importância do ecletismo para a convivência"] },
      { titulo: "5. Importância da educação", topicos: ["O cidadão e seu protagonismo", "O valor da educação"] },
      { titulo: "6. Egito", topicos: ["A regra de Maat", "A justiça como impulso coletivo"] },
      { titulo: "7. Roma e os estoicos", topicos: ["Roma e os cidadãos do mundo", "Estoicos: Sêneca, Epíteto e Marco Aurélio"] },
    ],
  },
  NFH: {
    curso: "Filosofia para Viver (N1)",
    bloco: "Para construir o futuro",
    temas: [
      { titulo: "1. Filosofia da história", topicos: ["A experiência como motor do futuro"] },
      { titulo: "2. Importância da transmissão", topicos: ["História: fontes, fundamentos e ciências complementares"] },
      { titulo: "3. História e mitologia", topicos: ["Realidade psicológica dos mitos", "Propriedade dos símbolos"] },
      { titulo: "4. Os ciclos da história", topicos: ["O movimento da humanidade", "O ciclo da história"] },
      { titulo: "5. Liberdade e destino", topicos: ["Teoria histórica de Cícero", "Os arquétipos fixos e a evolução da humanidade", "Nosso passado e nosso futuro"] },
    ],
  },
  // Apostila "Introdução à Sabedoria do Oriente" (revisão 2019), 15 temas do sumário.
  IS1: {
    curso: "Introdução à Sabedoria do Oriente (ISO)",
    temas: [
      { titulo: "Tema I: O Enigma de Deus", topicos: ["A Filosofia Natural ou Esotérica", "Os três princípios", "Constituição setenária do homem", "Corpos e subcorpos"] },
      { titulo: "Tema II: Sistema Solar", topicos: ["O Triplo Logos Solar", "Sistema, Cadeia, Ronda, Globo e Humanidade"] },
      { titulo: "Tema III: Antropogênese Oculta", topicos: ["Da Primeira à Sétima Humanidade"] },
      { titulo: "Tema IV: Dharma e Karma", topicos: ["Categorias e modalidades kármicas", "Livre-arbítrio", "Reencarnação"] },
      { titulo: "Tema V: Conceito Geral de Religião e de Religiões", topicos: ["Religiões naturais e reveladas", "O segundo princípio no religioso"] },
      { titulo: "Tema VI: Conceito Esotérico de Religião", topicos: ["Manifestação sétupla do Triplo Logos", "Os três tipos de avatares", "Ronda de avatares"] },
      { titulo: "Tema VII: Particularidades de cada Mestre", topicos: ["Vyasa, Hermes Trimegisto, Zoroastro, Orfeu e Buda", "Jesus Cristo e Maomé"] },
      { titulo: "Tema VIII: A Filosofia Atemporal e suas Expressões Limitadas", topicos: ["Sociedades de estudos esotéricos", "A Grande Fraternidade Branca"] },
      { titulo: "Tema IX: O Neoplatonismo", topicos: ["A Sociedade Eclética de Alexandria", "Giordano Bruno, Rosacrucismo, Maçonaria, Espiritismo", "Sociedade Teosófica"] },
      { titulo: "Tema X: O Uno sem Segundo, o Uno Ilusório", topicos: ["Aritmética e geometria", "Gênese das formas"] },
      { titulo: "Tema XI: Fenômenos Físicos, Químicos e Alquímicos", topicos: ["Alquimia", "Átomo, molécula e valência", "Astrologia", "Yoga"] },
      { titulo: "Tema XII: Biologia", topicos: ["Histologia", "Anatomia esotérica e sistemas orgânicos", "Os éteres"] },
      { titulo: "Tema XIII: Zoologia", topicos: ["Linha dévica e linha humana", "Alma grupal"] },
      { titulo: "Tema XIV: Botânica" },
      { titulo: "Tema XV: O Futuro" },
    ],
  },
  PSI: {
    curso: "Psicologia",
    temas: [
      "Introdução",
      "Consciência",
      "Atenção",
      "Memória",
      "Inteligência",
      "Imaginação",
      "Hábitos",
      "Sensações",
      "Fenômenos afetivos",
      "Personalidade",
      "Vontade",
      "Psicanálise e psicossíntese",
      "Parapsicologia",
    ].map((t, i) => ({ titulo: `Psicologia ${i + 1}: ${t}` })),
  },
};

/**
 * Provas que cobrem várias matérias de uma vez (pedido do usuário 2026-10-21:
 * "no N1 só tem uma prova, que é a de conclusão do nível, com Ética,
 * Sociedade e Filosofia da História"). A chave vira a "matéria" da atividade
 * (Activity.materiaSigla = "N1") e os temas dos blocos aparecem juntos,
 * separados por bloco, gravados com o nome do bloco na frente.
 */
export const PROVAS_CONJUNTAS: Record<string, { nome: string; rotuloCurto: string; cobre: string; tituloSugerido: string; materias: { sigla: string; rotulo: string }[] }> = {
  N1: {
    nome: "Conclusão do N1 (Ética, Sociedade e Filosofia da História)",
    rotuloCurto: "Conclusão do N1",
    cobre: "Prova única do nível: cobre Ética, Sociedade e Filosofia da História.",
    tituloSugerido: "Prova de conclusão do N1",
    materias: [
      { sigla: "NET", rotulo: "Ética" },
      { sigla: "NSC", rotulo: "Sociedade" },
      { sigla: "NFH", rotulo: "Filosofia da História" },
    ],
  },
};

/** Prova conjunta de que a matéria faz parte (ex.: NET → "N1"), se houver. */
export function provaConjuntaDa(sigla: string) {
  return Object.keys(PROVAS_CONJUNTAS).find((k) => PROVAS_CONJUNTAS[k].materias.some((m) => m.sigla === sigla)) ?? null;
}

export function catalogoDaMateria(sigla: string | null | undefined): CatalogoMateria | null {
  if (!sigla) return null;
  const conjunta = PROVAS_CONJUNTAS[sigla.toUpperCase()];
  if (conjunta) {
    return {
      curso: conjunta.nome,
      temas: conjunta.materias.flatMap((m) =>
        (TEMAS_POR_MATERIA[m.sigla]?.temas ?? []).map((t) => ({ ...t, titulo: `${m.rotulo} · ${t.titulo}`, rotulo: t.titulo, grupo: m.rotulo })),
      ),
    };
  }
  return TEMAS_POR_MATERIA[sigla.toUpperCase()] ?? null;
}

/** Mantém só temas que existem no catálogo da matéria (na ordem do catálogo). */
export function temasValidos(sigla: string | null | undefined, escolhidos: string[]): string[] {
  const catalogo = catalogoDaMateria(sigla);
  if (!catalogo) return [];
  const set = new Set(escolhidos);
  return catalogo.temas.map((t) => t.titulo).filter((t) => set.has(t));
}
