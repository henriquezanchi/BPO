import { db } from "@/lib/db";
import { semEmoji } from "@/lib/compartilhar-evento";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import crypto from "node:crypto";
import { z } from "zod";

/**
 * Resumo da descrição para as telas de TV (pedido do usuário 2026-10-24): a descrição
 * inteira cortada com "…" lia mal de longe. A IA escreve uma chamada curta, uma vez por
 * descrição; fica em Event.resumoTela e resumoTelaDe guarda a impressão da descrição
 * resumida (se a descrição mudar, resume de novo).
 *
 * Sem ANTHROPIC_API_KEY (ou antes do resumo ficar pronto), a TV usa a primeira frase
 * completa da descrição (primeiraFrase).
 */
const ResumoTela = z.object({
  resumo: z.string().describe("Chamada curta para a TV, em português, até 120 caracteres."),
});

const LIMITE = 120;
const MAX_POR_RODADA = 20;

export function impressaoDescricao(descricao: string) {
  return crypto.createHash("sha1").update(descricao).digest("hex").slice(0, 16);
}

function limpar(texto: string) {
  return semEmoji(texto)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Primeiras frases completas que cabem no limite; sem frase curta o bastante, corta na palavra. */
export function primeiraFrase(descricao: string, limite = 160) {
  const texto = limpar(descricao);
  if (texto.length <= limite) return texto;
  const frases = texto.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
  let saida = "";
  for (const f of frases) {
    if ((saida + f).trim().length > limite) break;
    saida += f;
  }
  if (saida.trim()) return saida.trim();
  const corte = texto.slice(0, limite);
  return `${corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:\s]+$/, "")}…`;
}

async function resumir(cliente: Anthropic, titulo: string, descricao: string) {
  // Mesmo modelo barato da leitura de cartaz (Claude Haiku 5.5, esforço baixo).
  const resposta = await cliente.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 1000,
    output_config: { effort: "low", format: zodOutputFormat(ResumoTela) },
    messages: [
      {
        role: "user",
        content: `Escreva uma chamada curta para uma TV de divulgação da escola de filosofia Nova Acrópole, sobre o evento "${titulo}".
Regras: português do Brasil, uma ou duas frases completas, no máximo ${LIMITE} caracteres; diga do que se trata e o que a pessoa vai viver ou aprender; não repita o título; não cite data, horário, local, preço nem link (já aparecem na tela); sem emojis, hashtags ou aspas; não invente nada que não esteja na descrição.

Descrição do evento:
${limpar(descricao).slice(0, 3000)}`,
      },
    ],
  });
  if (resposta.stop_reason === "refusal") return null;
  const resumo = resposta.parsed_output?.resumo?.trim();
  return resumo && resumo.length <= LIMITE + 40 ? resumo : null;
}

/**
 * Resume as descrições ainda sem resumo (ou que mudaram). Sem ids, pega os eventos
 * publicados dos próximos 45 dias; com ids, só esses (chamado pela TV depois de responder).
 */
export async function gerarResumosTela(ids?: string[]) {
  if (!process.env.ANTHROPIC_API_KEY) return { resumidos: 0, aviso: "ANTHROPIC_API_KEY não configurada" };
  const agora = new Date();
  const eventos = await db.event.findMany({
    where: ids
      ? { id: { in: ids }, description: { not: null } }
      : { status: "publicado", description: { not: null }, startsAt: { gte: new Date(agora.getTime() - 864e5), lte: new Date(agora.getTime() + 45 * 864e5) } },
    select: { id: true, title: true, description: true, resumoTelaDe: true },
  });
  const pendentes = eventos
    .filter((e) => e.description!.trim().length > 160 && e.resumoTelaDe !== impressaoDescricao(e.description!))
    .slice(0, MAX_POR_RODADA);
  const cliente = new Anthropic();
  let resumidos = 0;
  const erros: string[] = [];
  for (const e of pendentes) {
    try {
      const resumo = await resumir(cliente, limpar(e.title), e.description!);
      if (!resumo) continue;
      await db.event.update({ where: { id: e.id }, data: { resumoTela: resumo, resumoTelaDe: impressaoDescricao(e.description!) } });
      resumidos++;
    } catch (erro) {
      if (erro instanceof Anthropic.RateLimitError) break;
      erros.push(`${e.title}: ${erro instanceof Anthropic.APIError ? `${erro.status} ${erro.message}` : String(erro)}`.slice(0, 200));
    }
  }
  return { resumidos, pendentes: pendentes.length, erros };
}
