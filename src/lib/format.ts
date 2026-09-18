export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Datas "puras" (sem hora) neste projeto são sempre gravadas como
 * meia-noite UTC (Date.UTC(ano, mes, dia) ou new Date("aaaa-mm-dd")) —
 * formatar sem fixar timeZone: "UTC" aplica o fuso LOCAL do servidor e
 * pode voltar 1 dia (bug real, achado ao vivo: Fundação "06/02" virava
 * "05/02" numa máquina com fuso negativo).
 */
export function formatDateBR(date: Date) {
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatDateTimeBR(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}
