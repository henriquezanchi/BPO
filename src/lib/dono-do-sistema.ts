/**
 * Dono do sistema (pedido do usuário 2026-10-25: "preciso ter acesso a todas as funcionalidades").
 * Vale como administração nacional (todas as filiais e áreas, liberar acessos, Nacional, secretarias
 * da rede) e como direção da própria filial (telas que ainda conferem `isDiretor`).
 */
// Matrículas do Mercúrio. Configurável por DONOS_DO_SISTEMA (separadas por vírgula, 26/10/2026); sem a variável, a do usuário.
const DONOS_DO_SISTEMA = new Set((process.env.DONOS_DO_SISTEMA ?? "21596").split(",").map((m) => m.trim()).filter(Boolean));

export function ehDonoDoSistema(m: { mercurioId: string | null }): boolean {
  return !!m.mercurioId && DONOS_DO_SISTEMA.has(m.mercurioId);
}
