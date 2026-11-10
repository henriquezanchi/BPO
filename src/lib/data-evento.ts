/**
 * Fuso em que se lê a data de um compromisso (correção do usuário 10/11/2026: "não faz sentido mostrar uma data
 * diferente da que ele acontece localmente"). Evento de dia inteiro é uma data, não um instante: vale a data gravada
 * (em UTC). Evento com horário: no fuso de onde acontece (fusoLocal); sem ele, no fuso da filial de quem vê.
 */
export type ComFuso = { allDay?: boolean | null; fusoLocal?: string | null };

export const fusoDoCompromisso = (item: ComFuso, fusoPadrao: string) => (item.allDay ? "UTC" : (item.fusoLocal ?? fusoPadrao));

/** Data civil (AAAA-MM-DD) do compromisso, no fuso em que ele acontece. */
export const dataCivilDoCompromisso = (item: ComFuso & { date: Date }, fusoPadrao: string) => item.date.toLocaleDateString("en-CA", { timeZone: fusoDoCompromisso(item, fusoPadrao) });
