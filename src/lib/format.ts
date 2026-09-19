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

/**
 * Monta o href de "conversar no WhatsApp" (wa.me) a partir de um número
 * salvo SEM código de país (DDD + número, como vem do Mercúrio) — sem o
 * "55" na frente, o wa.me interpreta o DDD como código de país (ex: "66"
 * virou Tailândia, bug real visto ao vivo). Só não adiciona se o número já
 * vier com o 55 (13 dígitos: 55 + DDD + celular de 9 dígitos).
 */
export function whatsappHref(numero: string, texto?: string) {
  const digitos = numero.replace(/\D/g, "");
  const comPais = digitos.length === 13 && digitos.startsWith("55") ? digitos : `55${digitos}`;
  const query = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return `https://wa.me/${comPais}${query}`;
}
