/**
 * Boletim Aurora (pedido do usuário 2026-10-26): boletim mensal de novidades da Nova Acrópole, publicado em
 * acropole.org.br/boletim-aurora. As edições são posts do WordPress da categoria 104; a mais recente é lida pela API
 * pública do site, com cache de 6 h. Sem resposta, o Portal mostra só o link da página do boletim.
 */
export const PAGINA_BOLETIM_AURORA = "https://acropole.org.br/boletim-aurora/";
const API = "https://acropole.org.br/wp-json/wp/v2/posts?categories=104&per_page=1&_fields=date,link,title,excerpt";

export type EdicaoAurora = { titulo: string; data: string; link: string; resumo: string };

const ENTIDADES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", hellip: "…", ndash: "–", mdash: "—" };

/** Texto puro a partir do HTML do WordPress (tags fora, entidades decodificadas, "[…]" do resumo fora). */
export function textoDoWordpress(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/\s*\[…\]\s*$/, "…")
    .replace(/\s+/g, " ")
    .trim();
}

export async function ultimaEdicaoAurora(): Promise<EdicaoAurora | null> {
  try {
    const r = await fetch(API, { headers: { accept: "application/json" }, next: { revalidate: 6 * 60 * 60 }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const [p] = (await r.json()) as { date: string; link: string; title: { rendered: string }; excerpt: { rendered: string } }[];
    if (!p?.link?.startsWith("https://acropole.org.br/")) return null;
    return { titulo: textoDoWordpress(p.title.rendered), data: p.date, link: p.link, resumo: textoDoWordpress(p.excerpt.rendered) };
  } catch {
    return null;
  }
}
