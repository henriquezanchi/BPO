import { fortunaCreditarSaldo, fortunaGetBranches, fortunaGetClient, fortunaSearchClientsByName } from "@/lib/fortuna/client";

/**
 * Só existe pra ser chamado pela Vercel (via FORTUNA_PROXY_URL), nunca por
 * tráfego externo de verdade — ver o comentário grande em fortuna/client.ts
 * sobre o desafio Cloudflare que bloqueia chamadas à API do Fortuna vindas
 * da Vercel. Este endpoint roda no Railway (onde FORTUNA_PROXY_URL não está
 * configurado, então fortuna/client.ts chama o Fortuna direto normalmente)
 * e repassa o resultado.
 */
const FUNCOES: Record<string, (...args: never[]) => Promise<unknown>> = {
  getBranches: fortunaGetBranches,
  getClient: fortunaGetClient,
  searchClientsByName: fortunaSearchClientsByName,
  creditarSaldo: fortunaCreditarSaldo,
};

export async function POST(req: Request) {
  const secret = process.env.FORTUNA_PROXY_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const { fn, args } = (await req.json()) as { fn?: string; args?: unknown[] };
  const handler = fn ? FUNCOES[fn] : undefined;
  if (!handler) {
    return Response.json({ ok: false, error: `Função desconhecida: ${fn}` });
  }

  try {
    const result = await handler(...((args ?? []) as never[]));
    return Response.json({ ok: true, result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message });
  }
}
