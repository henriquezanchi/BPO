/**
 * Importa a agenda nacional/regional (Google Calendar da Diretoria) pro
 * Portal — pedido do usuário 2026-10-09. Fonte: endereço SECRETO em
 * formato iCal (não o público — essa agenda não é pública de verdade,
 * exige login; o endereço secreto funciona sem autenticação, só por ser
 * difícil de adivinhar). NATIONAL_CALENDAR_ICS_URL é esse link — nunca
 * commitar o valor real, só em .env/variável de ambiente.
 *
 * Upsert por `externalUid` (UID do VEVENT no Google, sufixado com a data
 * da ocorrência quando for recorrente) — roda de novo quantas vezes
 * quiser, nunca duplica. Recorrências (RRULE) expandidas via o próprio
 * helper do node-ical (expandRecurringEvent), que já trata RECURRENCE-ID
 * e EXDATE corretamente — testado ao vivo em 2026-10-09 contra os 661
 * eventos reais (870 ocorrências geradas na janela de 2 anos).
 *
 * NUNCA edita à mão um Event com source="google_calendar_nacional" — a
 * próxima rodada sobrescreve.
 *
 * Uso: npx tsx --env-file=.env scripts/sync-national-calendar.ts
 */
import ical, { expandRecurringEvent } from "node-ical";
import type { ParameterValue, VEvent } from "node-ical";
import { db } from "../src/lib/db";

const JANELA_FUTURO_ANOS = 2;

/** summary/description/location vêm como string OU {val, params} — ver doc do node-ical. */
function textoDe(valor: ParameterValue | undefined): string | null {
  if (valor === undefined) return null;
  return typeof valor === "string" ? valor : valor.val;
}

async function main() {
  const url = process.env.NATIONAL_CALENDAR_ICS_URL;
  if (!url) throw new Error("NATIONAL_CALENDAR_ICS_URL não configurada.");

  const dados = await ical.async.fromURL(url);
  const vevents = Object.values(dados).filter((e): e is VEvent => (e as { type?: string } | undefined)?.type === "VEVENT");
  console.log(`Eventos lidos do feed: ${vevents.length}`);

  const agora = new Date();
  const limiteFuturo = new Date(agora.getFullYear() + JANELA_FUTURO_ANOS, agora.getMonth(), agora.getDate());

  let processados = 0;
  let puladosCancelados = 0;
  let semTitulo = 0;

  for (const ev of vevents) {
    if (ev.status === "CANCELLED") {
      puladosCancelados++;
      continue;
    }
    if (!textoDe(ev.summary)) {
      semTitulo++;
      continue;
    }

    const instancias = ev.rrule ? expandRecurringEvent(ev, { from: agora, to: limiteFuturo }) : ev.start ? [{ start: ev.start, end: ev.end ?? ev.start, summary: ev.summary, isFullDay: ev.datetype === "date", isRecurring: false, isOverride: false, event: ev }] : [];

    for (const inst of instancias) {
      const uid = ev.rrule ? `${ev.uid}_${inst.start.toISOString()}` : ev.uid;
      const dadosEvento = {
        title: textoDe(inst.summary) ?? textoDe(ev.summary)!,
        description: textoDe(inst.event.description),
        location: textoDe(inst.event.location),
        startsAt: inst.start,
        endsAt: inst.end,
        allDay: inst.isFullDay,
      };
      await db.event.upsert({
        where: { externalUid: uid },
        update: dadosEvento,
        create: { ...dadosEvento, externalUid: uid, scope: "nacional", source: "google_calendar_nacional", price: 0 },
      });
      processados++;
    }
  }

  console.log(`✅ ${processados} evento(s) sincronizado(s). (${puladosCancelados} cancelado(s), ${semTitulo} sem título — pulados)`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
