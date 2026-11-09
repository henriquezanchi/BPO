import { lerCodigoDaAgenda, montarIcs, type EventoAgenda } from "@/lib/agenda-ics";
import { db } from "@/lib/db";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { camposPublico, eventosQueAPessoaVe } from "@/lib/event-policy";

export const dynamic = "force-dynamic";

/**
 * Agenda assinada da pessoa (iCalendar), para o Google Agenda, Apple e Outlook (09/11/2026). Público, mas só com o link
 * assinado (lib/agenda-ics.ts). Janela: 30 dias para trás e 6 meses para a frente. Inscrito = confirmado; publicado para
 * a pessoa e sem inscrição = "A confirmar"; inscrito em evento cancelado = cancelado (some da agenda dela).
 */
export async function GET(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;
  const memberId = lerCodigoDaAgenda(decodeURIComponent(codigo));
  if (!memberId) return new Response("Agenda não encontrada.", { status: 404 });
  const pessoa = await db.member.findUnique({ where: { id: memberId }, select: { ...camposPublico, mercurioAtivo: true } });
  if (!pessoa?.mercurioAtivo) return new Response("Agenda não encontrada.", { status: 404 });

  const de = new Date(Date.now() - 30 * 864e5);
  const ate = new Date(Date.now() + 183 * 864e5);
  const [inscricoes, visiveis] = await Promise.all([
    db.eventRegistration.findMany({
      where: { memberId, desistenciaEm: null, event: { startsAt: { gte: de, lte: ate } } },
      select: { event: { select: { id: true, title: true, description: true, location: true, startsAt: true, endsAt: true, allDay: true, createdAt: true, status: true } } },
    }),
    db.event.findMany({
      where: { AND: [eventosQueAPessoaVe(pessoa), { startsAt: { gte: de, lte: ate } }] },
      select: { id: true, title: true, description: true, location: true, startsAt: true, endsAt: true, allDay: true, createdAt: true, status: true },
      take: 300,
    }),
  ]);

  const porId = new Map<string, EventoAgenda>();
  const montar = (e: (typeof visiveis)[number], situacao: EventoAgenda["situacao"]): EventoAgenda => ({
    id: e.id,
    titulo: e.title,
    descricao: e.description,
    local: e.location,
    inicio: e.startsAt,
    fim: e.endsAt,
    diaInteiro: e.allDay,
    atualizadoEm: e.createdAt,
    situacao,
  });
  for (const e of visiveis) porId.set(e.id, montar(e, "a_confirmar"));
  for (const { event: e } of inscricoes) porId.set(e.id, montar(e, e.status === "cancelado" ? "cancelado" : "inscrito"));

  const origem = new URL(req.url).origin;
  const corpo = montarIcs([...porId.values()], {
    nome: "Nova Acrópole · Portal",
    urlEvento: (id) => `${origem}/eventos/${id}`,
    fuso: fusoDaEscola(pessoa.school.uf),
  });
  return new Response(corpo, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="nova-acropole.ics"',
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
