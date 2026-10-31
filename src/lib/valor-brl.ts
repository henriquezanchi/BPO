/**
 * Lê um valor em reais digitado pela pessoa (31/10/2026). Antes cada tela tirava todos os pontos e trocava a vírgula,
 * e "20.00" (teclado em inglês, hábito) virava R$ 2.000,00. Regras: vírgula é sempre o decimal; sem vírgula, um ponto
 * só com 1 ou 2 casas depois é decimal ("20.5", "20.00"); os demais pontos são de milhar ("1.234", "1.234,56").
 * Devolve null quando não é um valor.
 */
export function lerValorBRL(texto: string): number | null {
  const t = texto.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  let normal: string;
  if (t.includes(",")) {
    if ((t.match(/,/g) ?? []).length > 1) return null;
    normal = t.replace(/\./g, "").replace(",", ".");
  } else {
    const pontos = (t.match(/\./g) ?? []).length;
    normal = pontos === 1 && /\.\d{1,2}$/.test(t) ? t : t.replace(/\./g, "");
  }
  const valor = Number(normal);
  return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : null;
}
