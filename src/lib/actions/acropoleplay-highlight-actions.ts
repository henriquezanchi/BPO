"use server";

import { db } from "@/lib/db";

/** Card de destaque da Acrópole Play no Portal — sem registro, não aparece. Leitura pública (qualquer membro autenticado vê o mesmo destaque nacional). */
export async function getAcropolePlayHighlight() {
  return db.acropolePlayHighlight.findUnique({ where: { id: "global" } });
}
