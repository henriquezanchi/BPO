import { db } from "@/lib/db";
import { semEmoji, urlDoEventoNoPortal } from "@/lib/compartilhar-evento";
import { EVENT_AUDIENCES, agendaUlissesBranchWhere, eventScopeWhere, safeEventRegistrationUrl } from "@/lib/event-policy";
import { eventPosterUrl } from "@/lib/event-posters";
import { gerarResumosTela, impressaoDescricao, primeiraFrase } from "@/lib/resumo-tela";
import type { Prisma } from "@prisma/client";
import { after } from "next/server";
import crypto from "node:crypto";
import QRCode from "qrcode";

/**
 * Telas de TV da filial (pedido do usuário 2026-10-24): cada TV tem um link com token e
 * mostra, em rotação, os eventos dos próximos 30 dias dos públicos escolhidos, com a mesma
 * abrangência da Agenda (eventos de outras filiais abertos à filial também entram).
 * Públicos possíveis em lib/telas-publicos.ts.
 */
export const DIAS_NA_TELA = 30;
const FUSO = "America/Sao_Paulo";

export function novoTokenTela() {
  return crypto.randomBytes(18).toString("base64url");
}

export type SlideTela = {
  id: string;
  titulo: string;
  descricao: string | null;
  dia: string;
  mes: string;
  semana: string;
  hora: string | null;
  local: string | null;
  preco: string;
  publico: string;
  lanche: boolean;
  cartaz: string | null;
  qrSvg: string;
  linkVisivel: string;
  inscricaoNoPortal: boolean;
};

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("pt-BR", { timeZone: FUSO, ...o });

function horaTela(inicio: Date, fim: Date | null, diaInteiro: boolean) {
  if (diaInteiro) return null;
  const h = (d: Date) => fmt(d, { hour: "2-digit", minute: "2-digit" }).replace(":00", "h").replace(":", "h").replace(/^0/, "");
  const mesmoDia = fim && fmt(fim, { dateStyle: "short" }) === fmt(inicio, { dateStyle: "short" });
  return mesmoDia ? `${h(inicio)} às ${h(fim)}` : h(inicio);
}

function rotuloPublico(origem: string, publicos: string[]) {
  if (origem === "ulisses") return "Aberto ao público";
  if (publicos.includes("todos_ativos")) return "Para todos os alunos";
  const nomes = publicos.filter((p) => p !== "todos_ativos").map((p) => EVENT_AUDIENCES[p as keyof typeof EVENT_AUDIENCES]).filter(Boolean);
  return nomes.length ? `Para ${nomes.join(", ").replace(/, ([^,]*)$/, " e $1")}` : "Para todos os alunos";
}

/** Endereço curto para mostrar ao lado do QR (sem protocolo, sem "www."). */
function linkVisivel(url: string) {
  const u = new URL(url);
  const caminho = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
  return `${u.host.replace(/^www\./, "")}${caminho}`.slice(0, 48);
}

export async function telaPorToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return db.telaEventos.findUnique({ where: { token }, include: { school: { select: { id: true, uf: true, name: true, city: true } } } });
}

export async function slidesDaTela(tela: { publicos: string[]; school: { id: string; uf: string | null } }, urlPortal: string): Promise<SlideTela[]> {
  const agora = new Date();
  const ate = new Date(agora.getTime() + DIAS_NA_TELA * 864e5);
  const internos = tela.publicos.filter((p) => p !== "aberto_publico");
  const porPublico: Prisma.EventWhereInput[] = [];
  if (internos.length) porPublico.push({ publicos: { hasSome: internos }, source: { notIn: ["agora", "google_calendar_nacional", "ulisses"] } });
  if (tela.publicos.includes("aberto_publico")) porPublico.push({ source: "ulisses" });
  if (!porPublico.length) return [];

  const eventos = await db.event.findMany({
    where: {
      AND: [
        eventScopeWhere(tela.school),
        agendaUlissesBranchWhere(tela.school.id),
        { OR: porPublico },
        { status: "publicado", startsAt: { lte: ate } },
        // Em andamento ou futuro; sem horário de término, some 2 h depois do início.
        { OR: [{ endsAt: { gte: agora } }, { endsAt: null, startsAt: { gte: new Date(agora.getTime() - 2 * 36e5) } }] },
      ],
    },
    orderBy: { startsAt: "asc" },
    take: 40,
  });

  // Descrições longas sem resumo atual: a IA resume depois da resposta; a TV pega na próxima atualização.
  const semResumo = eventos.filter((e) => e.description && e.description.trim().length > 160 && e.resumoTelaDe !== impressaoDescricao(e.description)).map((e) => e.id);
  if (semResumo.length) after(() => gerarResumosTela(semResumo.slice(0, 8)).catch(() => {}));

  return Promise.all(
    eventos.map(async (e) => {
      const externo = e.source === "ulisses";
      const linkUlisses = externo ? safeEventRegistrationUrl(e.registrationUrl) : null;
      const destino = linkUlisses ?? urlDoEventoNoPortal(e.id, urlPortal);
      const preco = Number(e.price);
      return {
        id: e.id,
        titulo: semEmoji(e.title).replace(/\*/g, "").trim(),
        descricao: e.description ? (e.resumoTela && e.resumoTelaDe === impressaoDescricao(e.description) ? e.resumoTela : primeiraFrase(e.description)) || null : null,
        dia: fmt(e.startsAt, { day: "2-digit" }),
        mes: fmt(e.startsAt, { month: "short" }).replace(".", ""),
        semana: fmt(e.startsAt, { weekday: "long" }),
        hora: horaTela(e.startsAt, e.endsAt, e.allDay),
        local: e.location?.trim() || null,
        preco: preco > 0 ? preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Gratuito",
        publico: rotuloPublico(e.source, e.publicos),
        lanche: e.lancheCompartilhado,
        cartaz: (await eventPosterUrl(e.posterPath)) ?? (e.imageUrl?.startsWith("https://") ? e.imageUrl : null),
        qrSvg: await QRCode.toString(destino, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#043a33", light: "#0000" } }),
        linkVisivel: linkVisivel(destino),
        inscricaoNoPortal: !linkUlisses,
      } satisfies SlideTela;
    }),
  );
}
