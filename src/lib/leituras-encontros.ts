import { db } from "@/lib/db";
import { leiturasEmSequencia } from "@/lib/gaf-leituras";

/**
 * Leitura de cada encontro dos GAFs da pessoa (pedido do usuário 24/11/2026: a programação do GAF mostra a leitura).
 * A sequência depende de todos os encontros do grupo, por isso a consulta é por grupo inteiro.
 */
export async function leiturasDosEncontrosGaf(grupoIds: string[]) {
  const saida = new Map<string, string>();
  for (const grupoId of new Set(grupoIds)) {
    const todos = await db.groupMeeting.findMany({ where: { classGroupId: grupoId, status: { not: "cancelada" } }, orderBy: { startsAt: "asc" }, select: { id: true, leituraGaf: true } });
    for (const [id, l] of leiturasEmSequencia(todos)) if (l.texto) saida.set(id, `Leitura: ${l.texto.numero ? `${l.texto.numero}. ` : ""}${l.texto.titulo}`);
  }
  return saida;
}
