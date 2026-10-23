import type { Abertura, JsonRecord } from "./types";

export const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function numero(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatarReais(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatarCentavos(value: unknown): string {
  return formatarReais(numero(value) / 100);
}

export function formatarData(value: unknown, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "Data não informada";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(date);
}

export function isoDate(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function hora(minuto: unknown): string {
  const value = Math.max(0, Math.trunc(numero(minuto)));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function minutos(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function texto(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function objeto(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export function primeiraChave(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  return undefined;
}

export function dadosRegistro(value: unknown): JsonRecord {
  return objeto(value);
}

export function despesasDaAbertura(abertura: Abertura) {
  return abertura.registros.filter((registro) => registro.tipo === "despesa").map((registro) => {
    const dados = dadosRegistro(registro.dados);
    return {
      registro,
      dados,
      valor: Math.max(0, numero(dados.valor)),
      previsto: dados.previsto === true || dados.previsto === "true",
    };
  });
}

export function tituloCalendario(item: Record<string, unknown>): string {
  return texto(primeiraChave(item, ["title", "titulo", "nome", "name"]), "Atividade sem título");
}

export function dataCalendario(item: Record<string, unknown>): string {
  return isoDate(primeiraChave(item, ["startDate", "inicio", "data", "date", "primeiraAula"]));
}

export function idLead(lead: JsonRecord): string {
  return texto(primeiraChave(lead, ["id", "leadId", "mercurioId", "mercurio_id"]), "");
}

export function nomeLead(lead: JsonRecord): string {
  return texto(primeiraChave(lead, ["name", "nome", "fullName", "nomeCompleto"]), "Interessado sem nome informado");
}

