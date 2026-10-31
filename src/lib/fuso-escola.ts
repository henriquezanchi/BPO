/**
 * Fuso da filial pela UF (Barra do Garças-MT é uma hora antes de Brasília). Módulo puro desde 31/10/2026, para a fila
 * do Mercúrio (que também roda por script) usar o mesmo mapa; atendimentos.ts reexporta.
 */
const FUSO_POR_UF: Record<string, string> = {
  MT: "America/Cuiaba",
  MS: "America/Campo_Grande",
  AM: "America/Manaus",
  RR: "America/Boa_Vista",
  RO: "America/Porto_Velho",
  AC: "America/Rio_Branco",
};

export const fusoDaEscola = (uf: string | null | undefined) => FUSO_POR_UF[(uf ?? "").toUpperCase()] ?? "America/Sao_Paulo";

/** Meia-noite do dia 1 de ano/mês no fuso (instante em UTC). */
function meiaNoiteNoFuso(ano: number, mes: number, fuso: string) {
  const utc = Date.UTC(ano, mes - 1, 1);
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(utc));
  const v = (t: string) => Number(partes.find((p) => p.type === t)!.value);
  const deslocamento = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute")) - utc;
  return new Date(utc - deslocamento);
}

/**
 * Mês corrente no fuso da filial (31/10/2026): `inicio`/`fim` são instantes (para pagamentos e eventos) e
 * `inicioCivil`/`fimCivil` são datas civis à meia-noite UTC (para vencimentos, gravados assim).
 */
export function mesNoFuso(fuso: string, agora = new Date()) {
  const [ano, mes] = agora.toLocaleDateString("en-CA", { timeZone: fuso }).split("-").map(Number);
  const [anoSeguinte, mesSeguinte] = mes === 12 ? [ano + 1, 1] : [ano, mes + 1];
  return {
    ano,
    mes,
    inicio: meiaNoiteNoFuso(ano, mes, fuso),
    fim: meiaNoiteNoFuso(anoSeguinte, mesSeguinte, fuso),
    inicioCivil: new Date(Date.UTC(ano, mes - 1, 1)),
    fimCivil: new Date(Date.UTC(anoSeguinte, mesSeguinte - 1, 1)),
  };
}

/** Deslocamento do fuso em relação ao UTC no formato ISO ("-03:00"), para montar horários locais com new Date(). */
export function deslocamentoNoFuso(fuso: string, quando = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "longOffset" }).formatToParts(quando);
  const nome = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00";
  return nome === "GMT" ? "+00:00" : nome.replace("GMT", "");
}
