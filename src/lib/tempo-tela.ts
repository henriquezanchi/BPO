import type { SlideTela } from "@/lib/telas-eventos";
import type { FraseDaTela } from "@/lib/telas-frases";

/**
 * Tempo de cada slide da TV pelo texto que ele mostra (pedido do usuário 2026-10-25): leitura
 * silenciosa de um adulto, 200 a 250 palavras por minuto — usamos 200, porque quem lê a TV está
 * de passagem —, mais 3 s para olhar a imagem quando houver. Funções puras, usadas no navegador.
 */
export const PALAVRAS_POR_MINUTO = 200;
export const SEGUNDOS_IMAGEM = 3;
/** Limites: nada some antes de dar para achar o título, nem trava a rotação. */
export const TEMPO_MINIMO_MS = 5_000;
export const TEMPO_MAXIMO_MS = 45_000;

/** Palavras com letra ou número (emojis, traços e pontuação soltos não contam). */
export function contarPalavras(...textos: (string | null | undefined)[]): number {
  return textos
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}

function palavrasDoSlide(slide: SlideTela, frase: FraseDaTela | null): number {
  switch (slide.tipo) {
    case "evento":
      return contarPalavras(
        slide.semana, slide.dia, slide.mes, slide.hora, slide.titulo, slide.descricao, slide.local, slide.preco, slide.publico,
        slide.lanche ? "Lanche compartilhado: leve algo para partilhar" : null,
        "Inscreva-se pelo celular. Aponte a câmera para o código.",
      );
    case "cartao":
      return contarPalavras(slide.rotulo, slide.titulo, slide.texto, slide.quando?.semana, slide.quando?.dia, slide.quando?.mes, slide.quando?.hora, slide.chamada);
    case "frase":
      return frase ? contarPalavras(frase.texto, frase.autor, frase.obra) : 0;
    case "lista":
      return contarPalavras(slide.titulo, ...slide.itens.flatMap((i) => [i.destaque, i.texto, i.detalhe]));
  }
}

/** Milissegundos que o slide fica na tela. */
export function tempoDoSlide(slide: SlideTela | undefined, frase: FraseDaTela | null = null): number {
  if (!slide) return TEMPO_MINIMO_MS;
  const leitura = (palavrasDoSlide(slide, frase) / PALAVRAS_POR_MINUTO) * 60_000;
  const imagem = slide.tipo === "evento" && slide.cartaz ? SEGUNDOS_IMAGEM * 1000 : 0;
  return Math.round(Math.min(TEMPO_MAXIMO_MS, Math.max(TEMPO_MINIMO_MS, leitura + imagem)));
}
