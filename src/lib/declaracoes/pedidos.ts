import "server-only";
import { db } from "@/lib/db";
import type { Declaracao } from "./texto";

/**
 * Declaração pedida pelo próprio aluno (pedido do usuário 06/11/2026). O pedido é uma pendência da Escolástica
 * (ScholasticPendency, tipo "pedido_declaracao"); a entrega fica em ResumoNacional com a chave "declaracao:<id>",
 * sem tabela nova: modo "portal" guarda o texto final para o aluno abrir e imprimir; "retirar" só avisa que está
 * pronta na secretaria.
 */
export const TIPO_PEDIDO_DECLARACAO = "pedido_declaracao";

export type EntregaDeclaracao = { modo: "portal"; declaracao: Declaracao; entregueEm: string } | { modo: "retirar"; entregueEm: string };

export const chaveEntrega = (pedidoId: string) => `declaracao:${pedidoId}`;

/** Finalidade escrita pelo aluno, guardada nas observações da pendência ("Finalidade: ..."). */
export const finalidadeDoPedido = (notes: string | null) => notes?.match(/^Finalidade: (.*)$/m)?.[1]?.trim() ?? "";

export async function entregaDoPedido(pedidoId: string): Promise<EntregaDeclaracao | null> {
  const r = await db.resumoNacional.findUnique({ where: { chave: chaveEntrega(pedidoId) } });
  return (r?.dados as unknown as EntregaDeclaracao | undefined) ?? null;
}
