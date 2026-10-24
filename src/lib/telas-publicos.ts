import { EVENT_AUDIENCES } from "@/lib/event-policy";

/**
 * Públicos que uma tela de TV pode mostrar (pedido do usuário 2026-10-24). "Aberto ao público"
 * = eventos do Ulisses; os demais seguem Event.publicos. Sem acesso ao banco: usado também
 * na tela de gestão, no navegador.
 */
export const PUBLICOS_TELA = { aberto_publico: "Aberto ao público", ...EVENT_AUDIENCES } as const;
export type PublicoTela = keyof typeof PUBLICOS_TELA;

export function validarPublicosTela(publicos: string[]): PublicoTela[] {
  const v = [...new Set(publicos)].filter((p): p is PublicoTela => Object.hasOwn(PUBLICOS_TELA, p));
  if (!v.length) throw Error("Escolha ao menos um público para a tela.");
  return v;
}
