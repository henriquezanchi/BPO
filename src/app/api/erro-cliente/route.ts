import { NextResponse } from "next/server";

/**
 * Erros de JavaScript do navegador (25/11/2026): a página manda mensagem, pilha, URL e navegador, e isto vai para o
 * registro da Vercel (console.error), para investigar relatos como "o botão não faz nada". Sem dados pessoais, sem
 * banco, e só do próprio site (Origin). Corpo pequeno; resposta sempre 204.
 */
export async function POST(req: Request) {
  const origem = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origem && host && !origem.endsWith(`//${host}`)) return new NextResponse(null, { status: 204 });
  try {
    const texto = (await req.text()).slice(0, 4000);
    const dados = JSON.parse(texto) as { tipo?: string; mensagem?: string; pilha?: string; url?: string; ua?: string };
    console.error("[erro-cliente]", JSON.stringify({ tipo: dados.tipo, mensagem: dados.mensagem, url: dados.url, ua: dados.ua, pilha: dados.pilha }));
  } catch {
    /* corpo inválido: ignora */
  }
  return new NextResponse(null, { status: 204 });
}
