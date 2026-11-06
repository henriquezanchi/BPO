import { db } from "@/lib/db";

/**
 * Itens dos alertas de cadastro que a Escolástica marcou como "já corrigi no Mercúrio" (06/11/2026). Ficam escondidos
 * até o próximo resumo da filial: se o resumo novo ainda trouxer o item, a correção não pegou e ele volta. Guardado em
 * ResumoNacional "alertas-corrigidos:<schoolId>" (sem migração).
 */
export type Corrigido = { chave: string; em: string };
export const chaveCorrigidos = (schoolId: string) => `alertas-corrigidos:${schoolId}`;
export const chaveDoItem = (tipo: string, item: { matricula?: string; nome: string }) => `${tipo}:${item.matricula || item.nome}`;

export async function lerCorrigidos(schoolId: string): Promise<Corrigido[]> {
  const r = await db.resumoNacional.findUnique({ where: { chave: chaveCorrigidos(schoolId) }, select: { dados: true } });
  return ((r?.dados as { itens?: Corrigido[] } | null)?.itens ?? []).filter((c) => typeof c?.chave === "string");
}

/** Marcados depois da geração do resumo atual: o resumo ainda não teve chance de mostrar a correção. */
export function escondidos(corrigidos: Corrigido[], resumoGeradoEm: Date) {
  return new Set(corrigidos.filter((c) => new Date(c.em) > resumoGeradoEm).map((c) => c.chave));
}
