import type { AgendaItem } from "@/lib/member-data";
import { AGORA, chamarAgora, SemSessaoAgora } from "@/lib/agora/sessao";

/**
 * Eventos do Ágora na Agenda do aluno (túnel, 2026-10-27): `GET /api/eventos/acoes` como o próprio aluno — a mesma
 * lista da página inicial do Ágora, já filtrada por ele (perfil, sede, inscrições abertas) —, completada com
 * `/api/eventos/periodo` (data, descrição, local). A inscrição continua no Ágora (formulário, lotes e pagamento próprios):
 * o botão leva a `#/e/<slug>`. Formatos tratados com tolerância (data ISO, epoch ou lista; imagem por id ou objeto)
 * até a API externa estabilizar.
 */
type EventoAgora = {
  id: number | string;
  nome?: string;
  data?: string | number | number[];
  duracao?: number | null;
  local?: string | { nome?: string; descricao?: string; endereco?: string } | null;
  slug?: string;
  imagem?: number | string | { id?: number | string } | null;
  nacional?: boolean;
  regiao?: string | { nome?: string } | null;
  sede?: string | { nome?: string } | null;
  situacao?: string | null;
  texto?: string | null;
  gratuito?: boolean;
};

const nomeDe = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && "nome" in v && typeof v.nome === "string" ? v.nome : null);

/** Data do Ágora: ISO sem fuso = horário de Brasília. */
export function dataDoAgora(v: EventoAgora["data"]): Date | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return new Date(v);
  if (Array.isArray(v)) {
    const [a, m, d, h = 0, min = 0] = v;
    return new Date(`${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00-03:00`);
  }
  const s = v.length === 10 ? `${v}T00:00:00` : v;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const soData = (v: EventoAgora["data"]) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Descrição do Ágora (Markdown com <br>, visto em 27/10): texto em linhas, sem marcação — títulos sem "#", negrito
 * sem "**", itens de lista com "•". O cartão da Agenda mostra com as quebras (whitespace-pre-line).
 */
export function textoDoAgora(t: string) {
  return t
    .replace(/<br\s*\/?>[ \t]*\r?\n?/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.replace(/^\s*#{1,6}\s*/, "").replace(/^\s*[*-]\s+/, "• ").replace(/\*\*|__/g, "").replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Local: o Ágora manda a sigla da sede ("ITA"); com o nome da sede no evento, mostra o nome. */
function localDoEvento(e: EventoAgora): string | null {
  const local = typeof e.local === "string" ? e.local : (e.local?.nome ?? e.local?.descricao ?? e.local?.endereco ?? null);
  const sede = nomeDe(e.sede);
  if (local && /^[A-Z]{2,4}$/.test(local.trim()) && sede) return sede;
  return local ?? sede;
}

export function agendaDoAgora(lista: EventoAgora[]): AgendaItem[] {
  return lista.flatMap((e): AgendaItem[] => {
    const inicio = dataDoAgora(e.data);
    if (!inicio || !e.nome) return [];
    const imagemId = e.imagem && typeof e.imagem === "object" ? e.imagem.id : e.imagem;
    const regiao = nomeDe(e.regiao);
    return [
      {
        kind: "evento",
        id: `agora-${e.id}`,
        title: e.nome.trim(),
        date: inicio,
        price: 0,
        reactions: [],
        minhaInscricao: null,
        scope: e.nacional ? "nacional" : "regional",
        source: "agora",
        externalUid: String(e.id),
        filialOrigem: e.nacional ? null : (nomeDe(e.sede) ?? regiao),
        posterUrl: imagemId ? `${AGORA}/e/og/imagem/${imagemId}` : null,
        registrationUrl: e.slug ? `${AGORA}/#/e/${encodeURIComponent(e.slug)}` : `${AGORA}/`,
        status: /cancel/i.test(e.situacao ?? "") ? "cancelado" : "publicado",
        description: e.texto ? textoDoAgora(e.texto).slice(0, 3000) : null,
        location: localDoEvento(e),
        // O Ágora manda só a data ("2026-10-31") e a duração em DIAS (GGSS: 3 = 31/10 a 02/11), visto em 27/10:
        // evento de dia inteiro, sem hora inventada; o fim é o último dia.
        endsAt: soData(e.data) ? (e.duracao && e.duracao > 1 ? new Date(inicio.getTime() + (e.duracao - 1) * 864e5) : null) : e.duracao && e.duracao > 0 ? new Date(inicio.getTime() + e.duracao * 60_000) : null,
        allDay: soData(e.data),
      },
    ];
  });
}

/** Item de `/api/eventos/acoes`: o que o aluno pode fazer em cada evento (a página inicial do Ágora é montada com ele). */
type AcaoAgora = {
  contexto: string; // "Nome do evento DD/MM/AAAA"
  contextoId: string | number; // slug (INSCRICAO_NOVA) ou número da inscrição (INSCRICAO_EDITAR)
  tipo: string; // INSCRICAO_NOVA | INSCRICAO_EDITAR | ...
  imagemId?: number | null;
  info?: string | null; // " Valor: R$ 360"
  aviso?: string | null; // "Restam 2 dias Lote 3"
  regiao?: string | null; // NAC | RCO | RNN
  permiteSedeExterna?: boolean;
};

const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Agenda a partir das ações do aluno no Ágora (filtradas pelo próprio Ágora, pedido do Marcos 27/10), completadas com
 * data, descrição e local de `/api/eventos/periodo` quando o evento estiver lá (casamento pelo slug ou pelo nome).
 */
export function agendaDasAcoes(acoes: AcaoAgora[], periodo: EventoAgora[]): AgendaItem[] {
  const porSlug = new Map(periodo.filter((e) => e.slug).map((e) => [e.slug!, e]));
  const porNome = new Map(periodo.filter((e) => e.nome).map((e) => [normalizar(e.nome!), e]));
  return acoes.flatMap((a): AgendaItem[] => {
    if (!/^INSCRICAO_/.test(a.tipo ?? "")) return [];
    const m = (a.contexto ?? "").match(/^(.*?)\s+(\d{2})\/(\d{2})\/(\d{4})\s*$/);
    const nome = (m?.[1] ?? a.contexto ?? "").trim();
    if (!nome) return [];
    const inscrito = a.tipo === "INSCRICAO_EDITAR";
    const evento = (typeof a.contextoId === "string" ? porSlug.get(a.contextoId) : undefined) ?? porNome.get(normalizar(nome));
    const base = evento ? agendaDoAgora([evento])[0] : undefined;
    const data = base?.date ?? (m ? dataDoAgora(`${m[4]}-${m[3]}-${m[2]}`) : null);
    if (!data) return [];
    const slug = !inscrito && typeof a.contextoId === "string" ? a.contextoId : evento?.slug;
    const valor = (a.info ?? "").match(/Valor:\s*(R\$\s*[\d.,]+)/)?.[1] ?? null;
    const prazo = [a.aviso, (a.info ?? "").replace(/Valor:\s*R\$\s*[\d.,]+/, "")].map((t) => (t ?? "").trim()).filter(Boolean).join(" · ") || null;
    const item: AgendaItem = {
      ...(base && base.kind === "evento"
        ? base
        : { kind: "evento" as const, id: `agora-${a.contextoId}`, title: nome, date: data, price: 0, reactions: [], minhaInscricao: null, source: "agora", status: "publicado", description: null, location: null, endsAt: null, allDay: true }),
      title: nome,
      date: data,
      scope: a.regiao === "NAC" ? "nacional" : "regional",
      filialOrigem: a.regiao === "NAC" ? null : (base?.kind === "evento" ? base.filialOrigem : null) ?? a.regiao ?? null,
      posterUrl: a.imagemId ? `${AGORA}/e/og/imagem/${a.imagemId}` : base?.kind === "evento" ? base.posterUrl : null,
      registrationUrl: slug ? `${AGORA}/#/e/${encodeURIComponent(slug)}` : `${AGORA}/`,
      agora: { inscrito, valor, prazo },
    };
    return [item];
  });
}

/** Eventos do Ágora para o aluno; [] sem sessão do login unificado ou se o Ágora não responder a tempo. */
export async function eventosDoAgora(memberId: string): Promise<AgendaItem[]> {
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const hoje = new Date();
  const fim = new Date(hoje.getTime() + 180 * 864e5);
  try {
    const [acoes, periodo] = await Promise.race([
      Promise.all([
        chamarAgora<AcaoAgora[]>(memberId, "/api/eventos/acoes"),
        chamarAgora<EventoAgora[]>(memberId, `/api/eventos/periodo?ini=${d(hoje)}&fim=${d(fim)}`).catch(() => [] as EventoAgora[]),
      ]),
      new Promise<never>((_, nao) => setTimeout(() => nao(new Error("Ágora sem resposta em 6 s")), 6000)),
    ]);
    return Array.isArray(acoes) ? agendaDasAcoes(acoes, Array.isArray(periodo) ? periodo : []) : [];
  } catch (e) {
    if (!(e instanceof SemSessaoAgora)) console.error("Agenda: eventos do Ágora indisponíveis:", e instanceof Error ? e.message : e);
    return [];
  }
}
