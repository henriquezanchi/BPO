"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { podeGerirAvaliacao } from "@/lib/avaliacao";
import { achadosDoInstrutor, analisarRodada, comentarios, type Achado } from "@/lib/avaliacao-analise";
import { lerPerguntas, MINIMO_RESPOSTAS } from "@/lib/avaliacao-comum";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Sugestões da IA sobre uma rodada da avaliação (pedido do usuário 10/11/2026). Lê os números já calculados
 * (avaliacao-analise.ts) e os comentários escritos — anônimos, sem nome, matrícula nem data — e devolve temas,
 * pontos fortes e sugestões práticas. Gerado na hora, a pedido, e não fica guardado.
 *  - Direção/Escolástica: a escola toda ou um instrutor;
 *  - o próprio instrutor: só sobre ele, em rodada encerrada.
 */
const Saida = z.object({
  temas: z
    .array(z.object({ tema: z.string().describe("Tema recorrente nos comentários, em poucas palavras"), frequencia: z.enum(["muitos", "alguns", "poucos"]), resumo: z.string().describe("O que os alunos dizem sobre isso, em uma frase, sem citar ninguém") }))
    .describe("De 0 a 5 temas, do mais citado ao menos citado"),
  pontosFortes: z.array(z.string()).describe("De 0 a 3 pontos fortes, em uma frase cada"),
  sugestoes: z.array(z.string()).describe("De 2 a 5 sugestões práticas e concretas, em uma frase cada, começando por um verbo"),
  orientacao: z.string().describe("Para a direção: como conduzir a conversa de orientação com o(s) instrutor(es), em 2 ou 3 frases. Vazio quando o leitor é o próprio instrutor."),
});
export type SugestoesIA = z.infer<typeof Saida>;

export async function sugestoesDaAvaliacao(campanhaId: string, instrutorMatr?: string): Promise<{ ok: true; dados: SugestoesIA } | { ok: false; error: string }> {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false, error: "Entre no Portal de novo." };
  const c = await db.avaliacaoCampanha.findUnique({ where: { id: campanhaId } });
  if (!c) return { ok: false, error: "Rodada não encontrada." };
  const gestor = await podeGerirAvaliacao(eu, c.schoolId);
  const proprio = !!instrutorMatr && eu.isPedagogo && eu.mercurioId === instrutorMatr && c.status === "encerrada";
  if (!gestor && !proprio) return { ok: false, error: "Sem acesso a esta rodada." };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "A IA não está configurada no Portal." };

  const perguntas = lerPerguntas(c.perguntas);
  const respostas = await db.avaliacaoResposta.findMany({
    where: { campanhaId },
    select: { parte: true, classGroupId: true, turmaNome: true, instrutorMatr: true, instrutorNome: true, respostas: true },
  });
  const analise = analisarRodada(perguntas, respostas);
  const doInstrutor = instrutorMatr ? respostas.filter((r) => r.parte === "instrutor" && r.instrutorMatr === instrutorMatr) : [];
  if (instrutorMatr && doInstrutor.length < MINIMO_RESPOSTAS) return { ok: false, error: `São precisas pelo menos ${MINIMO_RESPOSTAS} respostas.` };

  const achados: Achado[] = instrutorMatr ? achadosDoInstrutor(analise, instrutorMatr, respostas) : analise.achadosDirecao;
  const textos = instrutorMatr ? comentarios(perguntas, respostas, { parte: "instrutor", instrutorMatr }) : comentarios(perguntas, respostas);
  const numeros = [
    analise.nota?.escola != null ? `Nota média dos instrutores na escola (${analise.nota.pergunta.min}-${analise.nota.pergunta.max}): ${analise.nota.escola.toFixed(1)}` : null,
    instrutorMatr ? (() => { const i = analise.nota?.porInstrutor.find((x) => x.id === instrutorMatr); return i?.media != null ? `Nota média deste instrutor: ${i.media.toFixed(1)} (${i.total} avaliações)` : null; })() : null,
    !instrutorMatr && analise.recomendacao?.escola != null ? `Recomendação da escola (${analise.recomendacao.pergunta.min}-${analise.recomendacao.pergunta.max}): ${analise.recomendacao.escola.toFixed(1)}${analise.recomendacao.nps !== null ? `, NPS ${analise.recomendacao.nps}` : ""}` : null,
  ].filter(Boolean);
  const leitor = proprio && !gestor ? "o próprio instrutor, que quer melhorar as aulas" : instrutorMatr ? "a direção da escola, que vai orientar este instrutor" : "a direção e a Secretaria de Escolástica, que orientam todos os instrutores";

  try {
    const cliente = new Anthropic();
    const r = await cliente.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Saida) },
      messages: [
        {
          role: "user",
          content: `Você apoia a pedagogia da Nova Acrópole, escola de filosofia à maneira clássica (aulas expositivas em turmas de adultos, com instrutores voluntários). Analise a avaliação anônima que os alunos fizeram e escreva para ${leitor}.

Regras:
- Português do Brasil, tom respeitoso, construtivo e direto. Nada de jargão de RH.
- Baseie-se só nos números, achados e comentários abaixo; não invente fatos. Se houver poucos comentários, diga menos.
- Nunca cite um comentário literalmente nem detalhe que possa identificar um aluno; resuma.
- Sugestões concretas, que um instrutor consiga aplicar na próxima aula (ex.: ritmo, exemplos do dia a dia, tempo para perguntas, retomada do tema anterior).
- ${proprio && !gestor ? "Deixe 'orientacao' vazio." : "Em 'orientacao', diga como conduzir a conversa: começar pelo que vai bem, focar em um ou dois pontos, combinar um acompanhamento."}

Números:
${numeros.join("\n") || "(sem números suficientes)"}

Achados do cruzamento dos dados:
${achados.map((a) => `- ${a.titulo}: ${a.texto}`).join("\n") || "(nenhum)"}

Comentários escritos (${textos.length}):
${textos.slice(0, 200).map((t) => `- [${t.pergunta.slice(0, 60)}] ${t.texto}`).join("\n") || "(nenhum)"}`,
        },
      ],
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) return { ok: false, error: "A IA não conseguiu analisar agora. Tente de novo." };
    const d = r.parsed_output;
    return { ok: true, dados: { ...d, orientacao: proprio && !gestor ? "" : d.orientacao } };
  } catch (e) {
    console.error("Sugestões da avaliação:", (e as Error).message);
    return { ok: false, error: "A IA não respondeu agora. Tente de novo em instantes." };
  }
}
