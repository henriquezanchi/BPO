/** Formatação compartilhada das telas de atendimento (horários sempre no fuso da filial). */

export const DIAS_LONGOS = ["Domingos", "Segundas", "Terças", "Quartas", "Quintas", "Sextas", "Sábados"];
export const MODALIDADE_ROTULO: Record<string, string> = { presencial: "Presencial", online: "Online", ambos: "Presencial ou online" };

export const rotuloHora = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

/** "aaaa-mm-dd" do instante no fuso. */
export const diaDe = (iso: string, fuso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: fuso });

export const horaDe = (iso: string, fuso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" });

/** Agrupa por dia local, na ordem recebida (Map.groupBy ainda falta em navegadores antigos). */
export function agruparPorDia<T extends { inicio: string }>(lista: T[], fuso: string) {
  const mapa = new Map<string, T[]>();
  for (const item of lista) {
    const dia = diaDe(item.inicio, fuso);
    mapa.set(dia, [...(mapa.get(dia) ?? []), item]);
  }
  return mapa;
}

/** "ter, 28/10" */
export const rotuloDia = (iso: string, fuso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
