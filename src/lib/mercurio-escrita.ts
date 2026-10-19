import type { School } from "@prisma/client";

/**
 * Pagamentos e alterações que gravam no Mercúrio só nas filiais liberadas
 * (School.mercurioEscrita — pedido do usuário 2026-10-19: hoje só Barra do
 * Garças). As outras veem "em breve" e o servidor recusa.
 */
export const MENSAGEM_EM_BREVE = "Pagamentos e alterações pelo Portal chegam em breve à sua filial. Por enquanto, fale com a secretaria.";

export function exigirEscritaMercurio(member: { school: Pick<School, "mercurioEscrita"> }) {
  if (!member.school.mercurioEscrita) throw new Error(MENSAGEM_EM_BREVE);
}
