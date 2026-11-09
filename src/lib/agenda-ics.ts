import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Agenda do Portal para o Google Agenda (e Apple, Outlook) por assinatura de link (pedido do usuário 09/11/2026,
 * "caminho 1"). Cada pessoa tem um link secreto `/api/agenda/<id>.<assinatura>.ics`; a assinatura (HMAC) impede que
 * alguém troque o id e veja a agenda de outra pessoa. Eventos em que ela se inscreveu entram confirmados; os publicados
 * para ela em que não se inscreveu entram provisórios, com "A confirmar:" no título e o link de inscrição.
 */
function segredo() {
  const s = process.env.CARTEIRINHA_SEGREDO || (process.env.CRON_SECRET ? `carteirinha:${process.env.CRON_SECRET}` : "");
  if (!s) throw new Error("Segredo da agenda não configurado.");
  return s;
}
const assinar = (memberId: string, chave: string) => createHmac("sha256", chave).update(`AGENDA:${memberId}`).digest("base64url").slice(0, 20);

export function codigoDaAgenda(memberId: string, chave = segredo()) {
  return `${memberId}.${assinar(memberId, chave)}`;
}

export function lerCodigoDaAgenda(codigo: string, chave = segredo()): string | null {
  const m = /^([a-z0-9]{10,40})\.([A-Za-z0-9_-]{20})$/.exec(codigo.replace(/\.ics$/i, "").trim());
  if (!m) return null;
  const esperado = Buffer.from(assinar(m[1], chave));
  const recebido = Buffer.from(m[2]);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? m[1] : null;
}

export type EventoAgenda = {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  inicio: Date;
  fim: Date | null;
  diaInteiro: boolean;
  atualizadoEm: Date;
  situacao: "inscrito" | "a_confirmar" | "cancelado";
};

/** Texto do iCalendar: escapa \ ; , e quebras de linha. */
const texto = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dia = (d: Date, fuso: string) => d.toLocaleDateString("en-CA", { timeZone: fuso }).replace(/-/g, "");

/** Linhas com mais de 75 bytes são dobradas (RFC 5545): o Google ignora linhas longas de alguns campos. */
function dobrar(linha: string) {
  const partes: string[] = [];
  let resto = linha;
  while (Buffer.byteLength(resto) > 74) {
    let corte = 74;
    while (Buffer.byteLength(resto.slice(0, corte)) > 74) corte--;
    partes.push(resto.slice(0, corte));
    resto = " " + resto.slice(corte);
  }
  partes.push(resto);
  return partes.join("\r\n");
}

export function montarIcs(eventos: EventoAgenda[], opcoes: { nome: string; urlEvento: (id: string) => string; fuso: string; agora?: Date }) {
  const agora = opcoes.agora ?? new Date();
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nova Acropole//Portal//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${texto(opcoes.nome)}`,
    `X-WR-TIMEZONE:${opcoes.fuso}`,
    // Pede ao Google e ao Apple para buscar de novo a cada 6 h (o Google decide o ritmo, em geral 8 a 24 h).
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const e of eventos) {
    const link = opcoes.urlEvento(e.id);
    const titulo = e.situacao === "a_confirmar" ? `A confirmar: ${e.titulo}` : e.titulo;
    const aviso =
      e.situacao === "a_confirmar"
        ? `Você ainda não confirmou presença. Para se inscrever: ${link}`
        : e.situacao === "inscrito"
          ? `Inscrição confirmada. Detalhes: ${link}`
          : `Evento cancelado. ${link}`;
    linhas.push("BEGIN:VEVENT", `UID:${e.id}@portal-nova-acropole`, `DTSTAMP:${utc(agora)}`, `LAST-MODIFIED:${utc(e.atualizadoEm)}`);
    if (e.diaInteiro) {
      const fimDia = new Date((e.fim ?? e.inicio).getTime() + 864e5);
      linhas.push(`DTSTART;VALUE=DATE:${dia(e.inicio, opcoes.fuso)}`, `DTEND;VALUE=DATE:${dia(fimDia, opcoes.fuso)}`);
    } else {
      linhas.push(`DTSTART:${utc(e.inicio)}`, `DTEND:${utc(e.fim && e.fim > e.inicio ? e.fim : new Date(e.inicio.getTime() + 2 * 3600_000))}`);
    }
    linhas.push(
      `SUMMARY:${texto(titulo)}`,
      `DESCRIPTION:${texto([aviso, e.descricao?.slice(0, 1500)].filter(Boolean).join("\n\n"))}`,
      `URL:${link}`,
      `STATUS:${e.situacao === "inscrito" ? "CONFIRMED" : e.situacao === "cancelado" ? "CANCELLED" : "TENTATIVE"}`,
      // Provisório não bloqueia a agenda da pessoa como ocupada.
      `TRANSP:${e.situacao === "inscrito" ? "OPAQUE" : "TRANSPARENT"}`,
    );
    if (e.local) linhas.push(`LOCATION:${texto(e.local)}`);
    linhas.push("END:VEVENT");
  }
  linhas.push("END:VCALENDAR");
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}
