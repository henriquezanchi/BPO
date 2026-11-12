"use server";

import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
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
