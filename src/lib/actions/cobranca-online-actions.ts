"use server";

import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
import { definirRepasseCartao } from "@/lib/spread";
import { revalidatePath } from "next/cache";

/** Economia → Cobrança on-line (12/11/2026): a filial escolhe se repassa a taxa do cartão ao aluno. */
export async function escolherRepasseCartao(schoolId: string, repassa: boolean) {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false as const, error: "Entre no Portal de novo." };
  const pode = ehDonoDoSistema(eu) || (await areasNaFilial(eu, schoolId)).includes("economia");
  if (!pode) return { ok: false as const, error: "Só a Economia e a direção da filial mudam esta opção." };
  await definirRepasseCartao(schoolId, !!repassa);
  revalidatePath("/economia");
  return { ok: true as const };
}

/** "Já lancei no Mercúrio": fecha o lançamento automático que parou para conferência humana (lib/problemas-pagamento.ts). */
export async function marcarLancadoAMao(tarefaId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false as const, error: "Entre no Portal de novo." };
  const tarefa = await db.mercurioSyncTask.findUnique({ where: { id: tarefaId }, select: { status: true, taskType: true, member: { select: { schoolId: true } } } });
  if (!tarefa || tarefa.taskType !== "lancar_contribuicao_paga") return { ok: false as const, error: "Lançamento não encontrado." };
  const pode = ehDonoDoSistema(eu) || (await areasNaFilial(eu, tarefa.member.schoolId)).includes("economia");
  if (!pode) return { ok: false as const, error: "Só a Economia e a direção da filial fazem isso." };
  if (tarefa.status !== "falhou") return { ok: true as const };
  const quando = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await db.mercurioSyncTask.update({
    where: { id: tarefaId },
    data: { status: "sincronizado", syncedAt: new Date(), lastError: `Lançado à mão no Mercúrio por ${eu.name} (matrícula ${eu.mercurioId ?? "?"}) em ${quando}.` },
  });
  revalidatePath("/economia");
  return { ok: true as const };
}
