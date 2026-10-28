/**
 * Avaliação de instrutores — tipos e questionário-base, sem acesso ao banco
 * (roda também no navegador). Ver avaliacao.ts.
 */

export type TipoPergunta = "texto" | "escala" | "escolha";

export interface Pergunta {
  id: string;
  /** "instrutor" se repete para cada instrutor do aluno; "geral" é respondida uma vez. */
  parte: "instrutor" | "geral";
  secao: string;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  opcoes?: string[];
  min?: number;
  max?: number;
  rotuloMin?: string;
  rotuloMax?: string;
}

export interface Questionario {
  titulo: string;
  introducao: string;
  perguntas: Pergunta[];
}

/**
 * Base nacional: formulário da Nova Acrópole Lago Norte (Avaliação Geral,
 * maio/2026), autorizado a nível nacional — enviado pelo usuário 2026-10-19.
 * Adaptações para o Portal:
 *  - "Dia de aulas", "Data de preenchimento" e "Quem é seu instrutor no 1º/2º
 *    horário" saem: o Portal já sabe a turma, a data e os instrutores de cada
 *    aluno (vínculo oficial do Mercúrio), e repete o bloco do instrutor para
 *    cada um deles.
 *  - A escala do instrutor no formulário original vai de 1 a 10 (o texto diz
 *    "0 a 10"); mantida de 1 a 10, como as opções do original.
 * A filial pode alterar tudo (Chefe, Sub-Chefe ou Secretaria de Escolástica).
 */
export const QUESTIONARIO_BASE: Questionario = {
  titulo: "Avaliação geral",
  introducao:
    "Prezado(a) membro(a):\n\nA Nova Acrópole está realizando esta pesquisa de satisfação com todos os membros. Ela tem por finalidade levantar informações que irão contribuir com a melhoria das nossas aulas. É uma pesquisa confidencial e não será revelada a identidade dos respondentes. Sua colaboração é valiosa, por isso precisamos muito da sua sinceridade nas respostas. Desde já, agradecemos pela sua colaboração para o aprimoramento da nossa escola.",
  perguntas: [
    {
      id: "instrutor_aperfeicoar",
      parte: "instrutor",
      secao: "Avaliação dos instrutores",
      texto: "Em quais pontos você entende que o(a) instrutor(a) poderia aperfeiçoar em suas aulas?",
      tipo: "texto",
      obrigatoria: true,
    },
    {
      id: "instrutor_nota",
      parte: "instrutor",
      secao: "Avaliação dos instrutores",
      texto: "Considerando uma visão geral, com que nota você avalia o(a) instrutor(a)?",
      tipo: "escala",
      obrigatoria: true,
      min: 1,
      max: 10,
    },
    {
      id: "nps",
      parte: "geral",
      secao: "Índice de Recomendação",
      texto: "Qual a probabilidade de você indicar a Nova Acrópole para um amigo ou familiar?",
      tipo: "escala",
      obrigatoria: true,
      min: 0,
      max: 10,
      rotuloMin: "Nenhuma",
      rotuloMax: "Com certeza",
    },
    {
      id: "nps_motivo",
      parte: "geral",
      secao: "Índice de Recomendação",
      texto:
        "Se a resposta foi de 0 a 6: nos diga o motivo desta nota. Se foi de 7 a 8: que dicas você daria para a Nova Acrópole melhorar? Se foi de 9 a 10: que ponto forte você destaca na Nova Acrópole?",
      tipo: "texto",
      obrigatoria: false,
    },
    {
      id: "aplicavel",
      parte: "geral",
      secao: "Autoavaliação",
      texto: "Você considera que o conteúdo que aprende na Nova Acrópole é aplicável no dia a dia de sua vida?",
      tipo: "escolha",
      obrigatoria: true,
      opcoes: ["Sim", "Não"],
    },
    {
      id: "aplicavel_motivo",
      parte: "geral",
      secao: "Autoavaliação",
      texto: "Se sim, se sente motivado para aplicar os conteúdos? Se não, por qual motivo?",
      tipo: "texto",
      obrigatoria: false,
    },
    {
      id: "pontos_discordancia",
      parte: "geral",
      secao: "Autoavaliação",
      texto: "Há algum(ns) ponto(s) específico(s) das matérias que não tenha gostado ou que não esteja(m) de acordo com seus princípios ou convicções?",
      tipo: "escolha",
      obrigatoria: true,
      opcoes: ["Sim", "Não"],
    },
    {
      id: "faixa_etaria",
      parte: "geral",
      secao: "Informações do aluno",
      texto: "Faixa etária",
      tipo: "escolha",
      obrigatoria: true,
      opcoes: ["Menos de 18 anos", "18 a 24 anos", "25 a 34 anos", "35 a 44 anos", "45 a 64 anos", "Acima de 64 anos"],
    },
    {
      id: "escolaridade",
      parte: "geral",
      secao: "Informações do aluno",
      texto: "Escolaridade / Formação",
      tipo: "escolha",
      obrigatoria: true,
      opcoes: ["Sem escolaridade", "1º Grau Primário", "Ensino Fundamental", "Ensino Médio", "Ensino Superior (completo ou incompleto)", "Pós-Graduação", "Mestrado ou Doutorado"],
    },
    {
      id: "convivencia",
      parte: "geral",
      secao: "Informações do aluno",
      texto: "Possui ou já teve algum problema de convivência na escola?",
      tipo: "escolha",
      obrigatoria: true,
      opcoes: ["Sim", "Não"],
    },
    {
      id: "observacoes",
      parte: "geral",
      secao: "Informações do aluno",
      texto: "Observações gerais",
      tipo: "texto",
      obrigatoria: false,
    },
  ],
};

/** Valida e normaliza perguntas vindas do editor ou do banco. */
export function lerPerguntas(json: unknown): Pergunta[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((p): p is Pergunta => !!p && typeof p === "object" && typeof (p as Pergunta).id === "string" && typeof (p as Pergunta).texto === "string")
    .map((p): Pergunta => ({
      id: p.id,
      parte: p.parte === "instrutor" ? "instrutor" : "geral",
      secao: String(p.secao ?? "").trim() || (p.parte === "instrutor" ? "Avaliação dos instrutores" : "Perguntas gerais"),
      texto: p.texto.trim(),
      tipo: (p.tipo === "escala" || p.tipo === "escolha" ? p.tipo : "texto") as TipoPergunta,
      obrigatoria: !!p.obrigatoria,
      ...(p.tipo === "escolha" ? { opcoes: (p.opcoes ?? []).map((o) => String(o).trim()).filter(Boolean) } : {}),
      ...(p.tipo === "escala"
        ? { min: Number.isFinite(p.min) ? Number(p.min) : 0, max: Number.isFinite(p.max) ? Number(p.max) : 10, rotuloMin: p.rotuloMin ?? undefined, rotuloMax: p.rotuloMax ?? undefined }
        : {}),
    }))
    .filter((p) => p.texto && (p.tipo !== "escolha" || (p.opcoes?.length ?? 0) >= 2) && (p.tipo !== "escala" || (p.max! > p.min! && p.max! - p.min! <= 20)));
}

/** Mínimo de respostas pra mostrar resultados de um recorte (anonimato). */
export const MINIMO_RESPOSTAS = 3;

/**
 * Convite da rodada para o WhatsApp (pedido do usuário 2026-10-27): a Escolástica manda nos grupos das turmas. O link
 * leva a /avaliacao (pede login antes, se preciso). Sem emojis: no wa.me eles chegavam como "�".
 */
export function linkWhatsappDaAvaliacao(titulo: string, urlPortal = "https://portal-na-one.vercel.app") {
  const texto = [
    `*${titulo.replace(/\*/g, "").trim()}*`,
    "A avaliação dos instrutores está aberta no Portal do Aluno. Leva poucos minutos, e as respostas não guardam quem respondeu.",
    `Responda aqui: ${urlPortal}/avaliacao`,
  ].join("\n\n");
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
