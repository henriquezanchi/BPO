import "server-only";
import { db } from "@/lib/db";
import type { ResumoFilialDados } from "@/lib/mercurio-db/resumo-filial";

export type MinhaTurma = { nome: string; sala: string | null; conclusao: string | null };

/**
 * Sala e previsão de conclusão da turma do aluno (pedido do usuário 06/11/2026: "não use formatura, mas conclusão"),
 * do resumo diário da filial. Previsão já vencida não aparece: no Mercúrio há turmas com a data desatualizada, e
 * essas viram alerta para a Escolástica (resumo-filial.ts).
 */
export async function minhaTurma(schoolId: string, turma: string, hoje = new Date()): Promise<MinhaTurma> {
  const r = await db.resumoFilial.findUnique({ where: { schoolId }, select: { dados: true } });
  const t = (r?.dados as unknown as ResumoFilialDados | undefined)?.turmas.lista.find((x) => x.turma === turma);
  const hojeIso = hoje.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const conclusao = t?.previsaoFormatura?.slice(0, 10) ?? null;
  return { nome: turma, sala: salaLegivel(t?.sala ?? null), conclusao: conclusao && conclusao >= hojeIso ? conclusao : null };
}

/** "PLATAO" → "Platão"; "ONLINE" → "Online". O Mercúrio grava em maiúsculas e às vezes sem acento. */
export function salaLegivel(sala: string | null): string | null {
  if (!sala) return null;
  const s = sala.trim().toLowerCase();
  const conhecidas: Record<string, string> = { platao: "Platão", "platão": "Platão", online: "Online" };
  return conhecidas[s] ?? s.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}
