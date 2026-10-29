/**
 * Séries da Acrópole Play para o carrossel do Portal (pedido do usuário 2026-10-29: divulgar uma série específica, não
 * só "Acrópole Play"). Lista tirada da página pública acropoleplay.com em 29/10/2026; capas só quando o nome do
 * arquivo confirma a série. O clique entra pelo login automático do aluno (/api/portal/acropole-play/entrar), que
 * abre a Play no início: o link automático não aceita ir direto para uma série.
 */
export type SeriePlay = { titulo: string; colecao: string; capa: string | null };

const CAPAS = "https://acropoleplay.com/wp-content/uploads";

export const SERIES_PLAY: SeriePlay[] = [
  { titulo: "O que fazer com a mente e as emoções", colecao: "Formação Humana", capa: `${CAPAS}/2025/08/mente-e-emocoes_capa-geral.webp` },
  { titulo: "Simbolismo do Antigo Egito", colecao: "Simbolismo Universal", capa: `${CAPAS}/2025/08/simbolismo_capa-geral.webp` },
  { titulo: "Sementes: o Bem", colecao: "Documentários Acrópole Play", capa: `${CAPAS}/2025/08/sementes-O-BEM-story-576x1024.webp` },
  { titulo: "Corpus Hermeticum", colecao: "Conteúdos exclusivos da Prof.ª Lúcia", capa: `${CAPAS}/2025/08/CORPUS_CAPA-GERAL.webp` },
  { titulo: "Além da alegria: o que é felicidade?", colecao: "Documentários Acrópole Play", capa: `${CAPAS}/2025/08/alem-alegria-vertical.webp` },
  { titulo: "Clube do Livro", colecao: "Livros comentados", capa: `${CAPAS}/2025/08/CAPA-PLATAFORMA-CLUBE-DO-LIVRO-geral.webp` },
  { titulo: "Oratória: o essencial", colecao: "Formação Humana", capa: null },
  { titulo: "Vida, morte e eternidade", colecao: "Documentários Acrópole Play", capa: `${CAPAS}/2025/08/vida-v-1.webp` },
  { titulo: "Uma conversa sobre Jung e suas experiências", colecao: "Acrópole Talks", capa: null },
];
