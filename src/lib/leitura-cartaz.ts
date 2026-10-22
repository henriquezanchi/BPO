import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Leitura do cartaz do evento por IA (pedido do usuário 2026-10-22): o que
 * já está escrito nele, para a postagem só acrescentar, numa faixa verde, o
 * que faltar. Cada imagem é lida UMA vez e o resultado fica em
 * Event.cartazLeitura — quem compartilhar depois usa o que está salvo, sem
 * nova leitura. Só lê de novo se a imagem do evento mudar (cartazLidoUrl).
 *
 * Sem ANTHROPIC_API_KEY, nada é lido e a postagem leva a faixa completa.
 */
export const LeituraCartaz = z.object({
  data: z.boolean().describe("O dia do evento aparece no cartaz (ex.: 9 de novembro, 09/11, sábado 25)."),
  horario: z.boolean().describe("O horário de início aparece (ex.: 20h, 19:30)."),
  local: z.boolean().describe("O local aparece (endereço, nome da sede ou bairro, ou 'online')."),
  // Telefone ou WhatsApp "para informações" não conta: quem recebe o post precisa do link de inscrição (22/10).
  inscricao: z.boolean().describe("Há um link, endereço de site ou QR code para a inscrição. Telefone ou WhatsApp não contam."),
});
export type LeituraCartaz = z.infer<typeof LeituraCartaz>;

const MAX_POR_RODADA = 15;

export function leituraConfigurada() {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function lerUmCartaz(cliente: Anthropic, url: string, titulo: string): Promise<LeituraCartaz | null> {
  // Modelo mais barato a pedido do usuário (2026-10-22): Claude Haiku 5.5, esforço baixo (leitura simples).
  const resposta = await cliente.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(LeituraCartaz) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url } },
          {
            type: "text",
            text: `Este é o cartaz de divulgação do evento "${titulo}". Diga apenas o que está escrito ou visível no cartaz: se mostra a data, o horário, o local e um link, site ou QR code de inscrição (telefone ou WhatsApp não contam). Responda false quando a informação não estiver no cartaz.`,
          },
        ],
      },
    ],
  });
  if (resposta.stop_reason === "refusal") return null;
  return resposta.parsed_output ?? null;
}

/** Lê os cartazes ainda não lidos (ou trocados) dos eventos futuros publicados do Ulisses. */
export async function lerCartazesPendentes() {
  if (!leituraConfigurada()) return { lidos: 0, aviso: "ANTHROPIC_API_KEY não configurada" };
  const eventos = await db.event.findMany({
    where: { source: "ulisses", status: "publicado", startsAt: { gt: new Date() }, imageUrl: { not: null } },
    select: { id: true, title: true, imageUrl: true, cartazLidoUrl: true },
  });
  const pendentes = eventos.filter((e) => e.imageUrl !== e.cartazLidoUrl).slice(0, MAX_POR_RODADA);
  const cliente = new Anthropic();
  let lidos = 0;
  const erros: string[] = [];
  for (const e of pendentes) {
    try {
      const leitura = await lerUmCartaz(cliente, e.imageUrl!, e.title);
      if (!leitura) continue;
      await db.event.update({ where: { id: e.id }, data: { cartazLeitura: leitura, cartazLidoUrl: e.imageUrl } });
      lidos++;
    } catch (erro) {
      if (erro instanceof Anthropic.RateLimitError) break;
      erros.push(`${e.title}: ${erro instanceof Anthropic.APIError ? `${erro.status} ${erro.message}` : String(erro)}`.slice(0, 200));
    }
  }
  return { lidos, pendentes: pendentes.length, erros };
}
