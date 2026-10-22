/**
 * Imagem do evento para a arte de compartilhamento (pedido do usuário
 * 2026-10-22: "coloque a imagem do evento na postagem criada pelo portal").
 * As imagens do Ulisses ficam num bucket S3 sem CORS: o navegador as mostra,
 * mas não deixa desenhá-las no canvas. Esta rota repassa a imagem pelo
 * próprio Portal — só desse bucket, só imagens e até 8 MB.
 */
const PERMITIDA = /^https:\/\/s3-sa-east-1\.amazonaws\.com\/br\.com\.acropolebrasil\.[a-z0-9.-]+\//i;
const LIMITE = 8 * 1024 * 1024;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!PERMITIDA.test(url)) return new Response("Imagem não permitida.", { status: 400 });
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const tipo = r?.headers.get("content-type") ?? "";
  if (!r?.ok || !tipo.startsWith("image/")) return new Response("Imagem indisponível.", { status: 502 });
  const corpo = await r.arrayBuffer();
  if (corpo.byteLength > LIMITE) return new Response("Imagem grande demais.", { status: 413 });
  return new Response(corpo, { headers: { "content-type": tipo, "cache-control": "public, max-age=86400, immutable" } });
}
