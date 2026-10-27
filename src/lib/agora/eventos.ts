import type { AgendaItem } from "@/lib/member-data";
import { AGORA, chamarAgora, SemSessaoAgora } from "@/lib/agora/sessao";

/**
 * Eventos do Ágora na Agenda do aluno (túnel, 2026-10-27): `GET /api/eventos/periodo` como o próprio aluno, então vêm
 * só os eventos que o Ágora libera para ele. A inscrição continua no Ágora (formulário, lotes e pagamento próprios):
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

const semHtml = (t: string) => t.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function agendaDoAgora(lista: EventoAgora[]): AgendaItem[] {
  return lista.flatMap((e): AgendaItem[] => {
    const inicio = dataDoAgora(e.data);
    if (!inicio || !e.nome) return [];
    const imagemId = e.imagem && typeof e.imagem === "object" ? e.imagem.id : e.imagem;
    const local = typeof e.local === "string" ? e.local : (e.local?.nome ?? e.local?.descricao ?? e.local?.endereco ?? null);
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
        description: e.texto ? semHtml(e.texto).slice(0, 1200) : null,
        location: local,
        // O Ágora manda só a data ("2026-10-31", visto em 27/10): evento de dia inteiro, sem hora inventada.
        endsAt: !soData(e.data) && e.duracao && e.duracao > 0 ? new Date(inicio.getTime() + e.duracao * 60_000) : null,
        allDay: soData(e.data),
      },
    ];
  });
}

/** Próximos 90 dias do Ágora para o aluno; [] sem sessão do login unificado ou se o Ágora não responder a tempo. */
export async function eventosDoAgora(memberId: string): Promise<AgendaItem[]> {
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const hoje = new Date();
  const fim = new Date(hoje.getTime() + 90 * 864e5);
  try {
    const lista = await Promise.race([
      chamarAgora<EventoAgora[]>(memberId, `/api/eventos/periodo?ini=${d(hoje)}&fim=${d(fim)}`),
      new Promise<never>((_, nao) => setTimeout(() => nao(new Error("Ágora sem resposta em 6 s")), 6000)),
    ]);
    return Array.isArray(lista) ? agendaDoAgora(lista) : [];
  } catch (e) {
    if (!(e instanceof SemSessaoAgora)) console.error("Agenda: eventos do Ágora indisponíveis:", e instanceof Error ? e.message : e);
    return [];
  }
}
