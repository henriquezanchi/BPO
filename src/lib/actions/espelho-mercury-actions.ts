"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { db } from "@/lib/db";
import type { AreaFilial } from "@/lib/areas-filial";

/**
 * Decisões sobre as pendências do espelho Mercury → Mercúrio antigo (src/lib/espelho-mercury). Escolástica decide
 * os itens de cadastro, Economia os de dinheiro e composição; a direção, todos (areasNaFilial).
 */
type Resultado = { ok: true; alterados: number } | { ok: false; error: string };

async function itensPermitidos(schoolId: string, ids: string[], status: string[]) {
  const itens = await db.espelhoMercuryItem.findMany({ where: { schoolId, id: { in: ids.slice(0, 200) }, status: { in: status } } });
  const areas = [...new Set(itens.map((i) => i.area as AreaFilial))];
  // Precisa ter TODAS as áreas dos itens escolhidos (não aprova dinheiro só por ser da Escolástica).
  const eu = await requireArea(schoolId, ...(areas.length ? areas : (["escolastica", "economia"] as AreaFilial[])));
  for (const a of areas) await requireArea(schoolId, a);
  return { eu, itens };
}

/** Manda para o robô. Só itens que o robô sabe fazer; revisão também pode, mas um por um (quem aprova olhou). */
export async function aprovarEspelho(schoolId: string, ids: string[]): Promise<Resultado> {
  try {
    const { eu, itens } = await itensPermitidos(schoolId, ids, ["pendente", "erro"]);
    const podem = itens.filter((i) => i.robo !== null && (!i.revisao || ids.length === 1));
    if (!podem.length) return { ok: false, error: "Nenhum dos itens escolhidos pode ser feito pelo robô." };
    const r = await db.espelhoMercuryItem.updateMany({
      where: { id: { in: podem.map((i) => i.id) } },
      data: { status: "aprovado", decididoPor: eu.id, decididoEm: new Date(), ultimoErro: null },
    });
    revalidatePath("/espelho-mercurio");
    return { ok: true, alterados: r.count };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Quem fez à mão no Mercúrio antigo marca aqui; a observação fica no histórico (ex.: nº do recibo gerado). */
export async function marcarFeitoManual(schoolId: string, id: string, observacao: string): Promise<Resultado> {
  try {
    const { eu, itens } = await itensPermitidos(schoolId, [id], ["pendente", "aprovado", "erro"]);
    if (!itens.length) return { ok: false, error: "Item não encontrado ou já resolvido." };
    await db.espelhoMercuryItem.update({ where: { id }, data: { status: "feito_manual", decididoPor: eu.id, decididoEm: new Date(), feitoEm: new Date(), observacao: observacao.trim().slice(0, 500) || null } });
    revalidatePath("/espelho-mercurio");
    return { ok: true, alterados: 1 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Não fazer no antigo (ex.: diferença esperada). Motivo obrigatório: some da lista e não volta com a mesma chave. */
export async function ignorarEspelho(schoolId: string, id: string, motivo: string): Promise<Resultado> {
  if (motivo.trim().length < 3) return { ok: false, error: "Diga por que não fazer." };
  try {
    const { eu, itens } = await itensPermitidos(schoolId, [id], ["pendente", "aprovado", "erro"]);
    if (!itens.length) return { ok: false, error: "Item não encontrado ou já resolvido." };
    await db.espelhoMercuryItem.update({ where: { id }, data: { status: "ignorado", decididoPor: eu.id, decididoEm: new Date(), observacao: motivo.trim().slice(0, 500) } });
    revalidatePath("/espelho-mercurio");
    return { ok: true, alterados: 1 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
