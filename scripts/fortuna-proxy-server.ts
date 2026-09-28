/**
 * Servidor HTTP dedicado só pra repassar chamadas do Fortuna vindas da
 * Vercel — ver o comentário grande em src/lib/fortuna/client.ts sobre o
 * desafio Cloudflare que bloqueia chamadas à API do Fortuna vindas da
 * Vercel (mas não do Railway). Antes esse endpoint vivia dentro do serviço
 * "web" do Next.js no Railway (src/app/api/internal/fortuna-proxy) — agora
 * que o site em si roda só na Vercel (o serviço "web" no Railway foi
 * removido), precisa de um lugar próprio, leve, sem depender do Next.js.
 *
 * Roda como serviço PERSISTENTE no Railway (não é cron) — startCommand:
 * "npx tsx scripts/fortuna-proxy-server.ts". Autenticado via
 * FORTUNA_PROXY_SECRET (mesmo valor configurado como FORTUNA_PROXY_URL/
 * FORTUNA_PROXY_SECRET na Vercel).
 */
import "dotenv/config";
import http from "node:http";
import { fortunaCreditarSaldo, fortunaGetBranches, fortunaGetClient, fortunaSearchClientsByName } from "../src/lib/fortuna/client";

const FUNCOES: Record<string, (...args: never[]) => Promise<unknown>> = {
  getBranches: fortunaGetBranches,
  getClient: fortunaGetClient,
  searchClientsByName: fortunaSearchClientsByName,
  creditarSaldo: fortunaCreditarSaldo,
};

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }

  const secret = process.env.FORTUNA_PROXY_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.writeHead(401).end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { fn, args } = JSON.parse(body) as { fn?: string; args?: unknown[] };
      const handler = fn ? FUNCOES[fn] : undefined;
      if (!handler) {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: `Função desconhecida: ${fn}` }));
        return;
      }
      const result = await handler(...((args ?? []) as never[]));
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, result }));
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: (e as Error).message }));
    }
  });
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, () => console.log(`Fortuna proxy ouvindo na porta ${port}`));
