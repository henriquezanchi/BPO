import { criarConexao, situacaoConexao } from "@/lib/telas-conexao";
import { qrSvg } from "@/lib/telas-eventos";

/** Conexão da TV pelo controle remoto (ver lib/telas-conexao.ts). Pública: a TV não tem login. */
export const dynamic = "force-dynamic";

const semCache = { "Cache-Control": "no-store" };

function origem(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "portal-na-one.vercel.app";
  return `${req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

/** A TV pede um código novo. */
export async function POST(req: Request) {
  try {
    const c = await criarConexao();
    const site = origem(req);
    return Response.json(
      { codigo: c.codigo, segredo: c.segredo, expiraEm: c.expiraEm.toISOString(), qrSvg: await qrSvg(`${site}/tv/conectar?c=${c.codigo}`), endereco: `${site.replace(/^https?:\/\//, "")}/tv/conectar` },
      { headers: semCache },
    );
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : "Erro ao gerar o código." }, { status: 503, headers: semCache });
  }
}

/** A TV pergunta se já foi conectada (?s=<segredo>). */
export async function GET(req: Request) {
  const segredo = new URL(req.url).searchParams.get("s") ?? "";
  return Response.json(await situacaoConexao(segredo), { headers: semCache });
}
