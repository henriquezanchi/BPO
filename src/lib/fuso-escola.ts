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
 * Data e hora "de parede" sem fuso (ex.: "2025-06-16T08:30", como o diário antigo do Firebase gravava) lida no fuso da
 * filial e devolvida como instante ISO em UTC. Sem isso, o servidor (UTC) e o navegador (Brasília) liam a mesma hora
 * de jeitos diferentes e a tela do diário de FV dava erro de hidratação (02/11/2026). Texto que já tem fuso (Z ou
 * ±hh:mm) ou que não parece data passa como está.
 */
export function instanteNoFuso(texto: string, fuso: string): string {
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return texto;
  const [ano, mes, dia, hora, min, seg] = m.slice(1).map((x) => Number(x ?? 0));
  const comoUtc = Date.UTC(ano, mes - 1, dia, hora, min, seg);
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(comoUtc));
  const v = (t: string) => Number(partes.find((p) => p.type === t)!.value);
  const deslocamento = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - comoUtc;
  return new Date(comoUtc - deslocamento).toISOString();
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
