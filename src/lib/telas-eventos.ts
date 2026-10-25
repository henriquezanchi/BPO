import { db } from "@/lib/db";
import { semEmoji, urlDoEventoNoPortal } from "@/lib/compartilhar-evento";
import { EVENT_AUDIENCES, agendaUlissesBranchWhere, eventScopeWhere, safeEventRegistrationUrl } from "@/lib/event-policy";
import { eventPosterUrl } from "@/lib/event-posters";
import { gerarResumosTela, impressaoDescricao, primeiraFrase } from "@/lib/resumo-tela";
import { FRASES_PADRAO, fraseDaSemana } from "@/lib/telas-frases";
import { TIPOS_CARTAO, type ConteudoTela, type TipoCartao } from "@/lib/telas-publicos";
import type { Prisma } from "@prisma/client";
import { after } from "next/server";
import crypto from "node:crypto";
import QRCode from "qrcode";

/**
 * Telas de TV da filial (pedido do usuário 2026-10-24): cada TV tem um link com token e
 * mostra, em rotação, os eventos dos próximos 30 dias dos públicos escolhidos, com a mesma
 * abrangência da Agenda (eventos de outras filiais abertos à filial também entram).
 * Entre os eventos entram os conteúdos escolhidos para a tela (matrículas, frase da semana,
 * cartões da filial, programação, aniversariantes). Públicos e conteúdos em lib/telas-publicos.ts.
 */
export const DIAS_NA_TELA = 30;
const FUSO = "America/Sao_Paulo";

export function novoTokenTela() {
  return crypto.randomBytes(18).toString("base64url");
}

type Quando = { dia: string; mes: string; semana: string; hora: string | null };

export type SlideEvento = Quando & {
  tipo: "evento";
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  preco: string;
  publico: string;
  lanche: boolean;
  cartaz: string | null;
  qrSvg: string;
  linkVisivel: string;
  inscricaoNoPortal: boolean;
};

export type IconeCartao = TipoCartao;

export type SlideCartao = {
  tipo: "cartao";
  id: string;
  icone: IconeCartao;
  rotulo: string;
  titulo: string;
  texto: string | null;
  quando: Quando | null;
  qrSvg: string | null;
  linkVisivel: string | null;
  chamada: string;
};

export type SlideFrase = { tipo: "frase"; id: string; texto: string; autor: string; obra: string | null };

export type SlideLista = {
  tipo: "lista";
  id: string;
  icone: "programacao" | "aniversariantes";
  titulo: string;
  itens: { destaque: string; texto: string; detalhe: string | null }[];
};

export type SlideTela = SlideEvento | SlideCartao | SlideFrase | SlideLista;

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("pt-BR", { timeZone: FUSO, ...o });
const horaCurta = (d: Date) => fmt(d, { hour: "2-digit", minute: "2-digit" }).replace(":00", "h").replace(":", "h").replace(/^0/, "");
const diaSp = (d: Date) => fmt(d, { year: "numeric", month: "2-digit", day: "2-digit" });

function horaTela(inicio: Date, fim: Date | null, diaInteiro: boolean) {
  if (diaInteiro) return null;
  const mesmoDia = fim && diaSp(fim) === diaSp(inicio);
  return mesmoDia ? `${horaCurta(inicio)} às ${horaCurta(fim)}` : horaCurta(inicio);
}

function quandoTela(d: Date, hora: string | null): Quando {
  return { dia: fmt(d, { day: "2-digit" }), mes: fmt(d, { month: "short" }).replace(".", ""), semana: fmt(d, { weekday: "long" }), hora };
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

export function qrSvg(destino: string) {
  return QRCode.toString(destino, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#043a33", light: "#0000" } });
}

function linkSeguro(link: string | null) {
  if (!link) return null;
  try {
    const u = new URL(link);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function telaPorToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return db.telaEventos.findUnique({ where: { token }, include: { school: { select: { id: true, uf: true, name: true, city: true, whatsapp: true } } } });
}

type TelaParaSlides = {
  publicos: string[];
  conteudos: string[];
  school: { id: string; uf: string | null; whatsapp: string | null };
};

export async function slidesDaTela(tela: TelaParaSlides, urlPortal: string): Promise<SlideTela[]> {
  const eventos = await eventosDaTela(tela);
  const slides = await Promise.all(eventos.map((e) => slideDoEvento(e, urlPortal)));
  const extras = await conteudosDaTela(tela, eventos);
  return intercalar(slides, extras);
}

async function eventosDaTela(tela: TelaParaSlides) {
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
  return eventos;
}

type EventoDb = Awaited<ReturnType<typeof eventosDaTela>>[number];

async function slideDoEvento(e: EventoDb, urlPortal: string): Promise<SlideEvento> {
  const externo = e.source === "ulisses";
  const linkUlisses = externo ? safeEventRegistrationUrl(e.registrationUrl) : null;
  const destino = linkUlisses ?? urlDoEventoNoPortal(e.id, urlPortal);
  const preco = Number(e.price);
  return {
    tipo: "evento",
    id: e.id,
    titulo: semEmoji(e.title).replace(/\*/g, "").trim(),
    descricao: e.description ? (e.resumoTela && e.resumoTelaDe === impressaoDescricao(e.description) ? e.resumoTela : primeiraFrase(e.description)) || null : null,
    ...quandoTela(e.startsAt, horaTela(e.startsAt, e.endsAt, e.allDay)),
    local: e.location?.trim() || null,
    preco: preco > 0 ? preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Gratuito",
    publico: rotuloPublico(e.source, e.publicos),
    lanche: e.lancheCompartilhado,
    cartaz: (await eventPosterUrl(e.posterPath)) ?? (e.imageUrl?.startsWith("https://") ? e.imageUrl : null),
    qrSvg: await qrSvg(destino),
    linkVisivel: linkVisivel(destino),
    inscricaoNoPortal: !linkUlisses,
  };
}

/** Um conteúdo extra a cada dois eventos; o que sobrar vai no fim. */
function intercalar(eventos: SlideTela[], extras: SlideTela[]) {
  const saida: SlideTela[] = [];
  let x = 0;
  eventos.forEach((e, i) => {
    saida.push(e);
    if (i % 2 === 1 && x < extras.length) saida.push(extras[x++]);
  });
  return saida.concat(extras.slice(x));
}

// ---------- Conteúdos além dos eventos ----------

const CHAMADA_CARTAO: Record<TipoCartao, string> = {
  matricula: "Garanta sua vaga",
  aviso: "Saiba mais pelo celular",
  instagram: "Siga a filial",
  play: "Assista pelo celular",
};
const DIAS_PLURAL = ["aos domingos", "às segundas-feiras", "às terças-feiras", "às quartas-feiras", "às quintas-feiras", "às sextas-feiras", "aos sábados"];
const minutoEmHora = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

async function conteudosDaTela(tela: TelaParaSlides, eventos: EventoDb[]): Promise<SlideTela[]> {
  const quer = new Set(tela.conteudos as ConteudoTela[]);
  const extras: SlideTela[] = [];
  if (quer.has("matriculas")) extras.push(...(await slidesMatriculas(tela)));
  if (quer.has("frase")) {
    // Frases da filial (ativas); sem nenhuma, a lista padrão.
    const daFilial = await db.fraseTela.findMany({ where: { schoolId: tela.school.id, ativa: true }, orderBy: { createdAt: "asc" }, select: { texto: true, autor: true, obra: true } });
    const f = fraseDaSemana(daFilial.length ? daFilial : FRASES_PADRAO);
    if (f) extras.push({ tipo: "frase", id: `frase-${f.autor}-${f.texto.length}`, ...f });
  }
  const tipos = (Object.keys(TIPOS_CARTAO) as TipoCartao[]).filter((t) => quer.has(TIPOS_CARTAO[t].conteudo));
  if (tipos.length) extras.push(...(await slidesCartoes(tela.school.id, tipos)));
  if (quer.has("programacao")) {
    const semana = slideProgramacao(eventos);
    if (semana) extras.push(semana);
  }
  // Nunca em TV aberta ao público (também barrado ao salvar a tela).
  if (quer.has("aniversariantes") && !tela.publicos.includes("aberto_publico")) {
    extras.push(...(await slidesAniversariantes(tela.school.id)));
  }
  return extras;
}

/** Turmas planejadas ou em curso com inscrição aberta (Aberturas de turma). */
async function slidesMatriculas(tela: TelaParaSlides): Promise<SlideCartao[]> {
  const agora = new Date();
  const hoje = new Date(`${diaSp(agora).split("/").reverse().join("-")}T00:00:00-03:00`);
  const turmas = await db.aberturaTurma.findMany({
    where: {
      schoolId: tela.school.id,
      status: { in: ["planejada", "em_curso"] },
      primeiraAula: { lte: new Date(agora.getTime() + 60 * 864e5) },
      OR: [{ inscricoesAte: { gte: hoje } }, { inscricoesAte: null, primeiraAula: { gte: hoje } }],
    },
    orderBy: { primeiraAula: "asc" },
    take: 2,
  });
  return Promise.all(
    turmas.map(async (t) => {
      // Inscrição: a aula inaugural publicada no Ulisses no mesmo dia; senão, o WhatsApp da secretaria.
      const inaugural = await db.event.findFirst({
        where: {
          AND: [
            eventScopeWhere(tela.school),
            agendaUlissesBranchWhere(tela.school.id),
            { source: "ulisses", status: "publicado", registrationUrl: { not: null } },
            { startsAt: { gte: new Date(t.primeiraAula.getTime() - 864e5), lte: new Date(t.primeiraAula.getTime() + 864e5) } },
          ],
        },
        orderBy: { startsAt: "asc" },
      });
      const doUlisses = inaugural && diaSp(inaugural.startsAt) === diaSp(t.primeiraAula) ? safeEventRegistrationUrl(inaugural.registrationUrl) : null;
      const zap = tela.school.whatsapp?.replace(/\D/g, "");
      const destino = doUlisses ?? (zap ? `https://wa.me/${zap.length <= 11 ? `55${zap}` : zap}?text=${encodeURIComponent(`Olá! Quero me matricular: ${t.titulo}`)}` : null);
      const fim = t.inicioMinuto + t.duracaoMinutos;
      const prazo = t.inscricoesAte ? ` Inscrições até ${fmt(t.inscricoesAte, { day: "numeric", month: "long" })}.` : "";
      return {
        tipo: "cartao",
        id: `matricula-${t.id}`,
        icone: "matricula",
        rotulo: "Matrículas abertas",
        titulo: semEmoji(t.titulo).trim(),
        texto: `Nova turma com aulas ${DIAS_PLURAL[t.diaSemana] ?? "semanais"}, das ${minutoEmHora(t.inicioMinuto)} às ${minutoEmHora(fim)}.${prazo}`,
        quando: quandoTela(t.primeiraAula, minutoEmHora(t.inicioMinuto)),
        qrSvg: destino ? await qrSvg(destino) : null,
        linkVisivel: destino ? (doUlisses ? linkVisivel(destino) : "WhatsApp da secretaria") : null,
        chamada: destino ? "Garanta sua vaga" : "Informações na secretaria",
      } satisfies SlideCartao;
    }),
  );
}

async function slidesCartoes(schoolId: string, tipos: TipoCartao[]): Promise<SlideCartao[]> {
  const hoje = new Date(Date.now() - 864e5);
  const cartoes = await db.telaCartao.findMany({
    where: { schoolId, tipo: { in: tipos }, OR: [{ ate: null }, { ate: { gte: hoje } }] },
    orderBy: { createdAt: "asc" },
    take: 12,
  });
  const ordem = Object.keys(TIPOS_CARTAO);
  cartoes.sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));
  return Promise.all(
    cartoes.map(async (c) => {
      const tipo = c.tipo as TipoCartao;
      const link = linkSeguro(c.link);
      return {
        tipo: "cartao",
        id: `cartao-${c.id}`,
        icone: tipo,
        rotulo: TIPOS_CARTAO[tipo]?.rotulo ?? "Aviso",
        titulo: c.titulo,
        texto: c.texto,
        quando: null,
        qrSvg: link ? await qrSvg(link) : null,
        linkVisivel: link ? linkVisivel(link) : null,
        chamada: link ? CHAMADA_CARTAO[tipo] ?? "Saiba mais" : "",
      } satisfies SlideCartao;
    }),
  );
}

function slideProgramacao(eventos: EventoDb[]): SlideLista | null {
  const limite = Date.now() + 7 * 864e5;
  const semana = eventos.filter((e) => e.startsAt.getTime() <= limite).slice(0, 7);
  if (semana.length < 2) return null;
  return {
    tipo: "lista",
    id: "programacao",
    icone: "programacao",
    titulo: "Programação da semana",
    itens: semana.map((e) => ({
      destaque: `${fmt(e.startsAt, { weekday: "short" }).replace(".", "")} ${fmt(e.startsAt, { day: "numeric" })}`,
      texto: semEmoji(e.title).replace(/\*/g, "").trim(),
      detalhe: horaTela(e.startsAt, e.endsAt, e.allDay),
    })),
  };
}

/** Membros ativos (Mercúrio) que fazem aniversário no mês; nome e último sobrenome. Páginas de 14 nomes. */
async function slidesAniversariantes(schoolId: string): Promise<SlideLista[]> {
  const [diaHoje, mesHoje] = diaSp(new Date()).split("/").map(Number);
  const membros = await db.member.findMany({ where: { schoolId, mercurioAtivo: true, birthDate: { not: null } }, select: { name: true, birthDate: true } });
  const doMes = membros
    .filter((m) => m.birthDate!.getUTCMonth() + 1 === mesHoje)
    .map((m) => {
      const partes = m.name.trim().split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
      return { dia: m.birthDate!.getUTCDate(), nome: partes.length > 1 ? `${partes[0]} ${partes.at(-1)}` : partes[0] };
    })
    .sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome))
    .slice(0, 56);
  const mes = new Date(Date.UTC(2026, mesHoje - 1, 15)).toLocaleString("pt-BR", { month: "long", timeZone: "UTC" });
  const paginas = Math.ceil(doMes.length / POR_PAGINA);
  return Array.from({ length: paginas }, (_, p) => ({
    tipo: "lista",
    id: `aniversariantes-${p}`,
    icone: "aniversariantes",
    titulo: `Aniversariantes de ${mes}${paginas > 1 ? ` (${p + 1}/${paginas})` : ""}`,
    itens: doMes.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA).map((a) => ({ destaque: String(a.dia).padStart(2, "0"), texto: a.nome, detalhe: a.dia === diaHoje ? "Hoje!" : null })),
  }));
}
const POR_PAGINA = 14;
