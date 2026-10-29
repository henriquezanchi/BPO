"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { FUNCOES_PORTAL } from "@/lib/busca-portal";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Busca com IA no Portal do Aluno (pedido do usuário 2026-10-29): quando a busca local não acha, a IA escolhe entre as
 * funções que a pessoa tem (os ids vêm da tela e são conferidos com o catálogo). Vai para a IA só o texto digitado e
 * o catálogo, nunca dados da pessoa. Claude Haiku 5.5, esforço baixo (fração de centavo por busca).
 */
const Escolha = z.object({ ids: z.array(z.string()).describe("Até 3 ids do catálogo, do mais provável ao menos; vazio se nada servir.") });
const cache = new Map<string, string[]>();

export async function buscarFuncoesComIA(consulta: string, disponiveis: string[]): Promise<string[]> {
  const m = await getAuthenticatedMember();
  if (!m || !process.env.ANTHROPIC_API_KEY) return [];
  const texto = consulta.trim().slice(0, 120);
  const funcoes = FUNCOES_PORTAL.filter((f) => disponiveis.includes(f.id));
  if (texto.length < 3 || !funcoes.length) return [];
  const chave = `${texto.toLowerCase()}|${funcoes.map((f) => f.id).join(",")}`;
  if (cache.has(chave)) return cache.get(chave)!;
  try {
    const resposta = await new Anthropic().messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 300,
      output_config: { effort: "low", format: zodOutputFormat(Escolha) },
      messages: [
        {
          role: "user",
          content: `Você ajuda um aluno da escola de filosofia Nova Acrópole a achar uma função no Portal do Aluno. Ele digitou: "${texto}".
Escolha no catálogo abaixo as funções que atendem ao que ele quer (até 3, da mais provável para a menos). Pense no sentido, não só nas palavras: "quanto devo" é a situação da contribuição; "lanche" é o Fortuna. Se nada no catálogo servir, devolva a lista vazia. Use só ids do catálogo.

Catálogo (id: título — descrição):
${funcoes.map((f) => `${f.id}: ${f.titulo} — ${f.descricao}`).join("\n")}`,
        },
      ],
    });
    const ids = (resposta.parsed_output?.ids ?? []).filter((id) => funcoes.some((f) => f.id === id)).slice(0, 3);
    if (cache.size > 500) cache.clear();
    cache.set(chave, ids);
    return ids;
  } catch (e) {
    console.error("Busca com IA:", e instanceof Error ? e.message : e);
    return [];
  }
}
