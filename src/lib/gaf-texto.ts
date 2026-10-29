import type { TextoGaf } from "@/lib/gaf-leituras";

/**
 * Texto do GAF dentro do Portal (pedido do usuário 2026-10-29: tocar no texto de trabalho deve abrir o texto, não o
 * site). O site do GAF trava cada artigo com uma senha guardada só na sessão do navegador (auth.js): quem chega por
 * link cai no login. O Portal, que já exige login e participação no GAF, busca a página do artigo no servidor e mostra
 * só o conteúdo, limpo: tags de texto permitidas, sem scripts, sem estilos, links só para as notas da própria página.
 */
const PERMITIDAS = new Set(["p", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "sup", "sub", "a", "ul", "ol", "li", "blockquote", "br", "hr", "article", "section", "aside", "div", "span", "small", "cite"]);
const VAZIAS = new Set(["br", "hr"]);

export function limparArtigo(html: string): string | null {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (!main) return null;
  const semBlocos = main
    // Conteúdo que nunca entra: scripts, estilos, mídias embutidas e a navegação do site (Voltar / Próximo).
    .replace(/<(script|style|template|iframe|object|embed|noscript|nav|form|svg|img)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(img|input|link|meta)\b[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  // Uma passada só: cada "<" vira uma tag permitida reescrita, some (tag proibida) ou é escapado (texto). Assim um "<"
  // solto não consegue remontar uma tag proibida depois da limpeza.
  return semBlocos
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|[<>]/g, (tag: string, nome: string | undefined, attrs: string | undefined) => {
      if (!nome) return tag === "<" ? "&lt;" : "&gt;";
      const t = nome.toLowerCase();
      if (!PERMITIDAS.has(t)) return "";
      if (tag.startsWith("</")) return VAZIAS.has(t) ? "" : `</${t}>`;
      const id = (attrs ?? "").match(/\sid\s*=\s*"([\w-]{1,40})"/i)?.[1];
      const href = t === "a" ? (attrs ?? "").match(/\shref\s*=\s*"(#[\w-]{1,40})"/i)?.[1] : undefined;
      return `<${t}${id ? ` id="${id}"` : ""}${href ? ` href="${href}"` : ""}>`;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Busca o artigo no site do GAF (guardado 1 dia) e devolve o HTML limpo; null se o site não responder. */
export async function artigoDoGaf(texto: TextoGaf): Promise<string | null> {
  try {
    const r = await fetch(texto.url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(10_000), headers: { "user-agent": "PortalNovaAcropole/1.0 (GAF)" } });
    if (!r.ok) return null;
    return limparArtigo(await r.text());
  } catch {
    return null;
  }
}
