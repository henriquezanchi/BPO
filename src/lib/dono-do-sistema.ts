/**
 * Dono do sistema (pedido do usuário 2026-10-25: "preciso ter acesso a todas as funcionalidades").
 * Vale como administração nacional (todas as filiais e áreas, liberar acessos, Nacional, secretarias
 * da rede) e como direção da própria filial (telas que ainda conferem `isDiretor`).
 */
const DONOS_DO_SISTEMA = new Set(["21596"]); // matrícula do Mercúrio

export function ehDonoDoSistema(m: { mercurioId: string | null }): boolean {
  return !!m.mercurioId && DONOS_DO_SISTEMA.has(m.mercurioId);
}
