/**
 * Dono do sistema (pedido do usuário 2026-10-25: "preciso ter acesso a todas as funcionalidades").
 * Vale como administração nacional (todas as filiais e áreas, liberar acessos, Nacional, secretarias
 * da rede) e como direção da própria filial (telas que ainda conferem `isDiretor`).
 */
// Matrículas do Mercúrio. Configurável por DONOS_DO_SISTEMA (separadas por vírgula, 26/10/2026); sem a variável, a do usuário.
const DONOS_DO_SISTEMA = new Set((process.env.DONOS_DO_SISTEMA ?? "21596").split(",").map((m) => m.trim()).filter(Boolean));

/** Matrículas dos donos do sistema (para avisos à administração nacional). */
export const donosDoSistema = () => [...DONOS_DO_SISTEMA];

export function ehDonoDoSistema(m: { mercurioId: string | null }): boolean {
  return !!m.mercurioId && DONOS_DO_SISTEMA.has(m.mercurioId);
}

/**
 * Direção liberada pelo dono do sistema (pedido do usuário 06/11/2026: "libere função de diretor"): a pessoa vale
 * como diretora da própria filial mesmo sem ser diretora no Mercúrio. A sincronização (mercurio-db/importar.ts)
 * recalcula `isDiretor` a cada rodada, por isso a lista fica aqui e é somada ao que vem do Mercúrio.
 * Matrículas; configurável por DIRECAO_LIBERADA (separadas por vírgula).
 *  2597 Fernando Vieira Paixão (RVD) · 3450 Heitor de Lima Matos (JAM) · 3006 Carlos Rangel Neves Otto (FOR)
 *  3097 Ana Beatriz Camara Silva Gama Pignataro (BSB) · 101 Luis Carlos Marques Fonseca (BSB)
 */
const DIRECAO_LIBERADA = new Set((process.env.DIRECAO_LIBERADA ?? "2597,3450,3006,3097,101").split(",").map((m) => m.trim()).filter(Boolean));

export function temDirecaoLiberada(mercurioId: string | null | undefined): boolean {
  return !!mercurioId && DIRECAO_LIBERADA.has(mercurioId);
}

/** Matrículas da lista acima (para consultas no banco). */
export const matriculasComDirecaoLiberada = () => [...DIRECAO_LIBERADA];
