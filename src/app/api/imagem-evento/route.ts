/**
 * Imagem do evento para a arte de compartilhamento (pedido do usuário
 * 2026-10-22: "coloque a imagem do evento na postagem criada pelo portal").
 * As imagens do Ulisses ficam num bucket S3 sem CORS: o navegador as mostra,
 * mas não deixa desenhá-las no canvas. Esta rota repassa a imagem pelo
 * próprio Portal — só desse bucket, só JPEG/PNG/WebP e até 8 MB.
 *
 * Segurança (01/11/2026): o endereço é conferido depois de normalizado (um "/../" não troca de bucket) e só o
 * bucket exato do Ulisses vale; SVG nunca passa (roda script no domínio do Portal).
 */
const HOST = "s3-sa-east-1.amazonaws.com";
const BUCKET = "br.com.acropolebrasil.ckfinder";
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const LIMITE = 8 * 1024 * 1024;
const PROTECAO = { "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox", "content-disposition": "inline" };

function enderecoPermitido(bruto: string) {
  try {
    const u = new URL(bruto);
    if (u.protocol !== "https:" || u.host !== HOST || u.username || u.password) return null;
    if (u.pathname.split("/")[1] !== BUCKET || /%2e|%2f|\\/i.test(u.pathname)) return null;
    return u;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = enderecoPermitido(new URL(req.url).searchParams.get("url") ?? "");
  if (!url) return new Response("Imagem não permitida.", { status: 400, headers: PROTECAO });
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "error" }).catch(() => null);
  const tipo = (r?.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!r?.ok || !TIPOS.has(tipo)) return new Response("Imagem indisponível.", { status: 502, headers: PROTECAO });
  if (Number(r.headers.get("content-length") ?? 0) > LIMITE) return new Response("Imagem grande demais.", { status: 413, headers: PROTECAO });
  const corpo = await r.arrayBuffer();
  if (corpo.byteLength > LIMITE) return new Response("Imagem grande demais.", { status: 413, headers: PROTECAO });
  // s-maxage: a CDN da Vercel guarda a imagem e a função não roda de novo a cada acesso.
  return new Response(corpo, { headers: { ...PROTECAO, "content-type": tipo, "cache-control": "public, max-age=86400, s-maxage=604800, immutable" } });
}
