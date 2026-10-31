/**
 * "Histórico da Carta de Degrau" (arquivo de texto), portado do diário de FV antigo (src/lib/cartaReport.js, 2026-10-31).
 * Lê o ciclo como uma trajetória: panorama da constância, cada item da Carta com as respostas em ordem cronológica,
 * agrupadas por semana, e perguntas para a releitura. Organizar por item (e não por dia) deixa visível o que mudou.
 */
import { ITENS_CARTA, textoDoItem, type ItensDegrau } from "@/lib/fv/comum";

const WIDTH = 72;
const RULE = "═".repeat(WIDTH);
const THIN = "─".repeat(WIDTH);
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const toDate = (key: string) => new Date(`${key}T12:00:00Z`);
const shortBR = (key: string) => {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
};
const longBR = (key: string) => toDate(key).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
const addDays = (key: string, n: number) => new Date(toDate(key).getTime() + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 864e5);

// Quebra um texto em linhas de até `width` caracteres, com recuo.
function wrap(text: string, indent: string, width = WIDTH) {
  const out: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (indent + line + " " + word).length > width) {
        out.push(indent + line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) out.push(indent + line);
  }
  return out;
}

const center = (text: string) => " ".repeat(Math.max(0, Math.floor((WIDTH - text.length) / 2))) + text;
const fmtMinutes = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
// Barra de constância de uma semana: um quadrado por dia do período.
const bar = (filled: number, total: number) => "■".repeat(filled) + "□".repeat(Math.max(0, total - filled));

export type DiaDaCarta = { data: string; itens: ItensDegrau; temPratica: boolean; minutosVoluntariado: number; minutosAulaAssistida: number; minutosAulaMinistrada: number };

export function historicoDaCarta({ dias, ultimaCarta, mestre, hoje }: { dias: DiaDaCarta[]; ultimaCarta: string | null; mestre: string | null; hoje: string }) {
  const itens = ITENS_CARTA.map((i) => ({ id: i.id, label: i.rotulo as string }));
  // Período: o dia seguinte à última Carta até hoje; sem Carta anterior, os últimos 30 dias.
  const periodStart = ultimaCarta && ultimaCarta < hoje ? addDays(ultimaCarta, 1) : addDays(hoje, -29);
  const periodEnd = hoje;
  const totalDays = daysBetween(periodStart, periodEnd) + 1;
  const inPeriod = dias.filter((e) => e.data >= periodStart && e.data <= periodEnd).sort((a, b) => a.data.localeCompare(b.data));

  const answeredByItem: Record<string, { date: string; text: string }[]> = Object.fromEntries(itens.map((i) => [i.id, []]));
  const daysWithText = new Set<string>();
  let practiceDays = 0,
    vol = 0,
    assist = 0,
    minist = 0;
  for (const e of inPeriod) {
    for (const item of itens) {
      const t = textoDoItem(e.itens, item.id, true);
      if (t) {
        answeredByItem[item.id].push({ date: e.data, text: t });
        daysWithText.add(e.data);
      }
    }
    if (e.temPratica) practiceDays++;
    vol += e.minutosVoluntariado;
    assist += e.minutosAulaAssistida;
    minist += e.minutosAulaMinistrada;
  }
  if (daysWithText.size === 0) return null;

  // Semanas do período (blocos de 7 dias a partir do início).
  const weeks: { start: string; end: string; days: number }[] = [];
  for (let start = periodStart; start <= periodEnd; start = addDays(start, 7)) {
    const end = addDays(start, 6) < periodEnd ? addDays(start, 6) : periodEnd;
    weeks.push({ start, end, days: daysBetween(start, end) + 1 });
  }
  const weekOf = (date: string) => Math.floor(daysBetween(periodStart, date) / 7);

  const L: string[] = [];
  L.push(RULE, "", center("HISTÓRICO DA CARTA DE DEGRAU"), center("A trajetória do ciclo"), "");
  L.push(center(`${longBR(periodStart)}  →  ${longBR(periodEnd)}`));
  if (mestre) L.push(center(`Para: ${mestre}`));
  L.push("", RULE, "");

  L.push("PANORAMA DO CICLO", THIN);
  L.push(`  Dias no período ............ ${totalDays}`);
  L.push(`  Dias com registro .......... ${daysWithText.size}  (${Math.round((daysWithText.size / totalDays) * 100)}%)`);
  L.push(`  Dias com práticas .......... ${practiceDays}`);
  if (vol) L.push(`  Voluntariado ............... ${fmtMinutes(vol)}`);
  if (assist) L.push(`  Aulas assistidas ........... ${fmtMinutes(assist)}`);
  if (minist) L.push(`  Aulas ministradas .......... ${fmtMinutes(minist)}`);
  L.push("");
  L.push("  Constância semanal (■ = dia com registro na Carta)");
  weeks.forEach((w, i) => {
    const filled = [...daysWithText].filter((d) => d >= w.start && d <= w.end).length;
    L.push(`  Semana ${String(i + 1).padStart(2)}  ${shortBR(w.start)}–${shortBR(w.end)}  ${bar(filled, w.days).padEnd(8)} ${filled}/${w.days}`);
  });
  L.push("");
  L.push("  Registros por item");
  for (const item of itens) {
    const n = answeredByItem[item.id].length;
    const name = item.label.length > 44 ? item.label.slice(0, 43) + "…" : item.label;
    L.push(`  ${name.padEnd(46, ".")} ${String(n).padStart(2)} dia(s)`);
  }
  L.push("", "");

  L.push("A TRAJETÓRIA DE CADA ITEM", THIN);
  L.push(...wrap("Cada item mostra as respostas em ordem, do começo ao fim do ciclo. Leia de cima para baixo e observe o que mudou.", "  "));
  L.push("");
  for (const item of itens) {
    const answers = answeredByItem[item.id];
    L.push("", RULE.slice(0, 3) + " " + item.label + " " + RULE.slice(0, Math.max(3, WIDTH - item.label.length - 5)));
    if (answers.length === 0) {
      L.push("", "  Nenhuma resposta registrada neste ciclo.");
      continue;
    }
    L.push(`  ${answers.length} registro(s) · do dia ${shortBR(answers[0].date)} ao dia ${shortBR(answers[answers.length - 1].date)}`);
    let currentWeek = -1;
    for (const a of answers) {
      const w = weekOf(a.date);
      if (w !== currentWeek) {
        currentWeek = w;
        L.push("", `  ┌ Semana ${w + 1} (${shortBR(weeks[w].start)} a ${shortBR(weeks[w].end)})`);
      }
      const head = `  │ ${WEEKDAYS[toDate(a.date).getUTCDay()]} ${shortBR(a.date)}  `;
      const cont = "  │" + " ".repeat(head.length - 3);
      wrap(a.text, "", WIDTH - head.length).forEach((line, i) => L.push((i === 0 ? head : cont) + line));
    }
    // Primeira e última respostas: o começo e o fim.
    if (answers.length >= 3) {
      const first = answers[0],
        last = answers[answers.length - 1];
      L.push("", "  ◆ Do começo ao fim do ciclo");
      L.push(`    Início (${shortBR(first.date)}):`);
      L.push(...wrap(first.text, "      "));
      L.push(`    Fim (${shortBR(last.date)}):`);
      L.push(...wrap(last.text, "      "));
    }
  }

  L.push("", "", RULE, "PARA A RELEITURA", THIN);
  [
    "Comparando o começo e o fim de cada item: o que mudou de fato?",
    "Que padrões se repetiram ao longo das semanas?",
    "Onde houve um avanço real, que já se nota no dia a dia?",
    "Em que ponto você ainda tropeça no fim do ciclo?",
    "Que semana teve menos registros, e o que aconteceu nela?",
  ].forEach((q) => L.push(...wrap(`• ${q}`, "  ")));
  L.push("", RULE, center(`Gerado em ${longBR(hoje)} pelo Diário de FV do Portal`), "");
  return { texto: L.join("\n"), inicio: periodStart, fim: periodEnd };
}
