import crypto from "node:crypto";

/** TEMPORÁRIO (2026-10-22): compara a resposta do Cloudflare para o Ágora e o Ulisses a partir da Vercel. Remover após o teste. */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET ?? "";
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  if (!segredo || recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const alvos = ["https://eventos.acropolebrasil.com.br/api/versao", "https://auth.acropolebrasil.com.br/as/realms/oinabnb/.well-known/openid-configuration", "https://api.acropolebrasil.com.br/eventos/7", "https://eventos.acropolebrasil.com.br/"];
  const resultado = [];
  for (const url of alvos) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "PortalNovaAcropole/1.0 (diagnostico)", "x-portal-na": "bypass" }, cache: "no-store" });
      resultado.push({ url, status: r.status, cfMitigated: r.headers.get("cf-mitigated"), ray: r.headers.get("cf-ray") });
    } catch (e) {
      resultado.push({ url, erro: String(e) });
    }
  }
  return Response.json(resultado);
}
