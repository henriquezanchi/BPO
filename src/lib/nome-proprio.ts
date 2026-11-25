const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "LUIZ HENRIQUE DE SOUZA" → "Luiz Henrique de Souza" (o Mercúrio guarda nomes em caixa alta). Serve no servidor e no cliente. */
export function nomeProprio(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}
