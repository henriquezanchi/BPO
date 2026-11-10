/**
 * Botões do Portal do Aluno num lugar só (10/11/2026, pedido do usuário: "vários botões de diversos tamanhos e cores
 * diferentes"). Antes cada tela tinha a sua constante BOTAO, com cantos, alturas e letras diferentes.
 *
 * - PRINCIPAL: a ação de cada bloco (verde sólido). Um por bloco.
 * - CONTORNO: a alternativa ao lado do principal (Cancelar, Pular, Baixar).
 * - PEQUENO: ações de linha dentro de listas (Editar, Remover, Marcar lida).
 * - TEXTO: atalho discreto em verde, sem caixa (Adicionar, Editar o grupo).
 * - *_LARGO: as mesmas cores ocupando a largura toda, com 48px (página inicial e janelas de pagamento).
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-60";

export const BOTAO_PRINCIPAL = `${BASE} min-h-11 bg-na-green px-4 text-[14px] text-white hover:bg-na-green-dark`;

export const BOTAO_CONTORNO = `${BASE} min-h-11 border border-gray-300 bg-white px-4 text-[14px] text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800`;

export const BOTAO_PEQUENO =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-[12px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800";

export const BOTAO_TEXTO =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-na-green-dark transition hover:bg-na-green-light disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40";

export const BOTAO_PRINCIPAL_LARGO =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 text-[14px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60";

export const BOTAO_CONTORNO_LARGO =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-[14px] font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
