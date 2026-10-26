/**
 * Ponte na Cloudflare (2026-10-22). O Cloudflare da Nova Acrópole desafia
 * (cf-mitigated: challenge) toda chamada vinda dos servidores da Vercel para
 * *.acropolebrasil.com.br — Ulisses, Ágora, o login unificado e o Fortuna. Este Worker
 * roda dentro da rede da Cloudflare e repassa ao Portal só chamadas a esses
 * endereços.
 *
 * Segurança: exige o cabeçalho x-ponte-chave (segredo PONTE_CHAVE, também
 * guardado no Portal) e só aceita os domínios de ALLOWED. Não guarda nada.
 *
 * Rotas:
 *  GET  /diagnostico         status de cada sistema visto daqui (sem chave; não devolve dados)
 *  ANY  /?url=<https://...>  repassa a chamada (com chave)
 */
export interface Env {
  PONTE_CHAVE: string;
}

// Fortuna (carteira do Café) entrou em 25/10/2026: o proxy antigo no Railway saiu do ar.
const ALLOWED = ["api.acropolebrasil.com.br", "eventos.acropolebrasil.com.br", "auth.acropolebrasil.com.br", "oinabnfortunaback.acropolebrasil.com.br"];
const DIAGNOSTICO = [
  "https://api.acropolebrasil.com.br/eventos/7",
  "https://eventos.acropolebrasil.com.br/api/versao",
  "https://auth.acropolebrasil.com.br/as/realms/oinabnb/.well-known/openid-configuration",
  "https://oinabnfortunaback.acropolebrasil.com.br/api/branch",
];
const UA = "PortalNovaAcropole/1.0 (ponte)";

function iguais(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/diagnostico") {
      const resultado = await Promise.all(
        DIAGNOSTICO.map(async (alvo) => {
          try {
            const r = await fetch(alvo, { headers: { accept: "application/json", "user-agent": UA } });
            return { alvo, status: r.status, bloqueado: r.headers.get("cf-mitigated") ?? null };
          } catch (e) {
            return { alvo, erro: String(e) };
          }
        }),
      );
      return Response.json(resultado);
    }

    if (!iguais(req.headers.get("x-ponte-chave") ?? "", env.PONTE_CHAVE ?? "")) return new Response("Não autorizado.", { status: 401 });
    const destino = url.searchParams.get("url");
    let alvo: URL;
    try {
      alvo = new URL(destino ?? "");
    } catch {
      return new Response("Informe ?url=", { status: 400 });
    }
    if (alvo.protocol !== "https:" || !ALLOWED.includes(alvo.hostname)) return new Response("Destino não permitido.", { status: 403 });

    const cabecalhos = new Headers();
    for (const h of ["accept", "content-type", "authorization", "cookie", "x-xsrf-token"]) {
      const v = req.headers.get(h);
      if (v) cabecalhos.set(h, v);
    }
    cabecalhos.set("user-agent", UA);
    // O desafio do Cloudflare deles é intermitente (22/10: em GRU ~metade das chamadas): GET tenta até 3 vezes.
    const corpo = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();
    let r = await fetch(alvo.toString(), { method: req.method, headers: cabecalhos, body: corpo, redirect: "manual" });
    for (let tentativa = 1; tentativa < 3 && req.method === "GET" && r.status === 403 && r.headers.get("cf-mitigated"); tentativa++) {
      await new Promise((ok) => setTimeout(ok, 400 * tentativa));
      r = await fetch(alvo.toString(), { method: req.method, headers: cabecalhos, redirect: "manual" });
    }
    const resposta = new Headers();
    // Ray ID da resposta do sistema de origem (o cf-ray desta resposta é o da própria ponte).
    const rayOrigem = r.headers.get("cf-ray");
    if (rayOrigem) resposta.set("x-origem-cf-ray", rayOrigem);
    for (const h of ["content-type", "set-cookie", "location", "cf-mitigated"]) {
      const v = r.headers.get(h);
      if (v) resposta.set(h, v);
    }
    return new Response(r.body, { status: r.status, headers: resposta });
  },
};
