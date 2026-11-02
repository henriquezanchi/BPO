"use server";

import { requireArea } from "@/lib/auth";
import { db } from "@/lib/db";
import { dadosDaDeclaracao, DeclaracaoErro } from "@/lib/declaracoes/dados";
import { montarDeclaracao, SECOES, type Declaracao, type Secao } from "@/lib/declaracoes/texto";

/**
 * Gera o texto de uma declaração (Escolástica ou direção da filial) com os dados do Mercúrio lidos na hora. A pessoa
 * precisa ser da filial de quem pede. O texto volta para a tela, que deixa ajustar antes de imprimir; nada é guardado.
 */
export async function gerarDeclaracao(
  schoolId: string,
  memberId: string,
  secoes: Secao[],
  finalidade: string,
): Promise<{ ok: true; declaracao: Declaracao } | { ok: false; error: string }> {
  await requireArea(schoolId, "escolastica");
  const [pessoa, escola] = await Promise.all([
    db.member.findFirst({ where: { id: memberId, schoolId }, select: { mercurioId: true } }),
    db.school.findUnique({ where: { id: schoolId }, select: { mercurioUnidade: true } }),
  ]);
  if (!pessoa?.mercurioId || !/^\d+$/.test(pessoa.mercurioId)) return { ok: false, error: "Pessoa sem matrícula do Mercúrio nesta filial." };
  if (!escola?.mercurioUnidade) return { ok: false, error: "Filial sem unidade do Mercúrio cadastrada." };
  const validas = SECOES.map((s) => s.id).filter((s) => secoes.includes(s));
  try {
    const dados = await dadosDaDeclaracao(pessoa.mercurioId, escola.mercurioUnidade);
    return { ok: true, declaracao: montarDeclaracao(dados, validas, { finalidade: finalidade.slice(0, 200) }) };
  } catch (e) {
    if (e instanceof DeclaracaoErro) return { ok: false, error: e.message };
    console.error("[Declaração] falha ao ler o Mercúrio:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Não foi possível ler o Mercúrio agora. Tente de novo em instantes." };
  }
}
