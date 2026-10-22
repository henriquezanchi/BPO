/**
 * Chamadas aos sistemas da Nova Acrópole (*.acropolebrasil.com.br: Ulisses,
 * Ágora, login unificado). Teste de 2026-10-22: o Cloudflare deles desafia
 * toda chamada vinda dos servidores da Vercel, mas deixa passar as que saem
 * de dentro da Cloudflare. Por isso, com PONTE_URL e PONTE_CHAVE
 * configurados, a chamada passa pela ponte (infra/ponte-cloudflare); sem
 * eles (ex.: rodando no computador), vai direto.
 */
export function ponteConfigurada() {
  return !!(process.env.PONTE_URL && process.env.PONTE_CHAVE);
}

export async function fetchAcropole(url: string, init: RequestInit = {}): Promise<Response> {
  if (!ponteConfigurada()) return fetch(url, init);
  const headers = new Headers(init.headers);
  headers.set("x-ponte-chave", process.env.PONTE_CHAVE!);
  return fetch(`${process.env.PONTE_URL}/?url=${encodeURIComponent(url)}`, { ...init, headers });
}
