/**
 * Leituras do GAF (pedido do usuário 2026-10-26): o Grupo de Acompanhamento Filosófico lê os textos da etapa em
 * sequência (cronograma em gaf.oinabn.com.br). A coordenação escolhe o texto de cada encontro, ou deixa automático:
 * a partir do primeiro encontro com um texto escolhido, os seguintes recebem os próximos textos do cronograma; uma
 * escolha manual no meio recomeça a sequência dali. "Sem leitura" pula o encontro sem avançar a sequência.
 * O participante toca no texto e lê no site do GAF.
 * Maat e Prometeu ainda estão "em construção" no site; entram aqui quando o cronograma for publicado.
 */
export const SITE_GAF = "https://gaf.oinabn.com.br";
export const SEM_LEITURA = "nenhuma";

export type TextoGaf = { codigo: string; etapa: string; numero: number; titulo: string; bimestre: number; tema: string; url: string };

const TESEU: { tema: string; textos: string[] }[] = [
  { tema: "O Herói, suas Provas e como superá-las", textos: ["O Heroísmo", "Triunfar na Vida", "O Herói e seus Companheiros", "A Experiência Pessoal"] },
  { tema: "Um Ideal e sua proposta de ação no mundo", textos: ["Filosofia, Cultura e Voluntariado", "Voluntariado", "Do maravilhoso que é transmitir o Ideal Filosófico", "Trabalhar em nome de algo maior"] },
  { tema: "Como atuar sobre si mesmo e no mundo, o Serviço", textos: ["Os desejos e a vontade", "O trabalho", "As barreiras invisíveis da ação", "A Ação"] },
  { tema: "Como atuar sobre si mesmo e no mundo, o Serviço", textos: ["As 3 virtudes", "Nossa atitude nas aulas", "Vontade - Ação", "O Exemplo de HPB"] },
  { tema: "A Fraternidade", textos: ["Para uma Cortesia Filosófica", "Importância da boa comunicação para obter a convivência", "Em que consiste nossa fraternidade filosófica?", "Irmandade"] },
  { tema: "A Bondade e a Generosidade", textos: ["A harmonia e a bondade", "Fazer parte", "Atuar com o coração", "Mozart é um gênio"] },
];

export const ETAPAS_GAF = {
  teseu: { nome: "Teseu", descricao: "1º ano: o Herói e suas Provas", pagina: `${SITE_GAF}/teseu.html` },
  maat: { nome: "Maat", descricao: "2º ano: Equilíbrio e Justiça (cronograma em construção no site)", pagina: `${SITE_GAF}/maat.html` },
  prometeu: { nome: "Prometeu", descricao: "3º ano: o Portador da Luz (cronograma em construção no site)", pagina: `${SITE_GAF}/prometeu.html` },
} as const;

let n = 0;
/** Cronograma em ordem de leitura (hoje só o Teseu tem os textos publicados). */
export const TEXTOS_GAF: TextoGaf[] = TESEU.flatMap((b, i) =>
  b.textos.map((titulo) => {
    n++;
    const numero = String(n).padStart(2, "0");
    return { codigo: `teseu-${numero}`, etapa: "teseu", numero: n, titulo, bimestre: i + 1, tema: b.tema, url: `${SITE_GAF}/artigos/teseu/artigo${numero}.html` };
  }),
);

const PELO_CODIGO = new Map(TEXTOS_GAF.map((t, i) => [t.codigo, i]));
export const textoGaf = (codigo: string | null | undefined) => (codigo && PELO_CODIGO.has(codigo) ? TEXTOS_GAF[PELO_CODIGO.get(codigo)!] : null);
export const rotuloTexto = (t: TextoGaf) => `#${String(t.numero).padStart(2, "0")} – ${t.titulo}`;

export type LeituraDoEncontro = { texto: TextoGaf | null; origem: "escolhida" | "automatica" | "sem_leitura" | "a_definir" };

/**
 * Texto de cada encontro, na ordem dos encontros (cancelados ficam fora). `escolhida` = gravada pela coordenação;
 * `automatica` = próxima da sequência; `a_definir` = antes do primeiro texto escolhido ou depois do fim do cronograma.
 */
export function leiturasEmSequencia(encontros: { id: string; leituraGaf: string | null }[]): Map<string, LeituraDoEncontro> {
  const r = new Map<string, LeituraDoEncontro>();
  let atual: number | null = null;
  for (const e of encontros) {
    if (e.leituraGaf === SEM_LEITURA) {
      r.set(e.id, { texto: null, origem: "sem_leitura" });
      continue;
    }
    const escolhido = e.leituraGaf ? PELO_CODIGO.get(e.leituraGaf) : undefined;
    if (escolhido !== undefined) {
      atual = escolhido;
      r.set(e.id, { texto: TEXTOS_GAF[escolhido], origem: "escolhida" });
      continue;
    }
    if (atual === null || atual + 1 >= TEXTOS_GAF.length) {
      r.set(e.id, { texto: null, origem: "a_definir" });
      if (atual !== null) atual = TEXTOS_GAF.length; // fim do cronograma: não recomeça sozinho
      continue;
    }
    atual++;
    r.set(e.id, { texto: TEXTOS_GAF[atual], origem: "automatica" });
  }
  return r;
}
