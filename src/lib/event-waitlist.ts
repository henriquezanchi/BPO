import { db } from "@/lib/db";
import { enviarPush } from "@/lib/push";

/**
 * Lista de espera de eventos lotados (pedido do usuário 2026-10-22). Quando
 * uma vaga abre (desistência), o primeiro da fila recebe um aviso push e a
 * vaga fica reservada a ele por RESERVA_MS; passado esse prazo sem
 * inscrição, a vez passa ao próximo. enrollEvent desconta as reservas dos
 * outros ao conferir o limite de vagas.
 */
export const RESERVA_MS = 12 * 60 * 60_000;

/** Reservas em vigor (avisados há menos de 12 h), exceto a da própria pessoa. */
export function reservasAtivasWhere(eventId: string, excetoMemberId?: string) {
  return { eventId, avisadoEm: { gte: new Date(Date.now() - RESERVA_MS) }, ...(excetoMemberId ? { memberId: { not: excetoMemberId } } : {}) };
}

/**
 * Oferece as vagas livres aos próximos da fila. Também limpa quem já se
 * inscreveu e quem deixou a reserva vencer. Roda na rotina de 5 em 5 min e
 * logo depois de uma desistência.
 */
export async function processarListaDeEspera(eventId?: string) {
  const agora = new Date();
  const eventos = await db.event.findMany({
    where: { ...(eventId ? { id: eventId } : {}), source: "manual", status: "publicado", startsAt: { gt: agora }, capacity: { not: null } },
    select: { id: true, title: true, capacity: true, registrationClosesAt: true, startsAt: true },
  });
  let avisados = 0;
  for (const e of eventos) {
    const fila = await db.eventWaitlist.findMany({ where: { eventId: e.id }, orderBy: { createdAt: "asc" } });
    if (!fila.length) continue;
    // Quem já se inscreveu sai da fila; reserva vencida sem inscrição também.
    const inscritos = new Set((await db.eventRegistration.findMany({ where: { eventId: e.id, memberId: { in: fila.map((f) => f.memberId) } }, select: { memberId: true } })).map((r) => r.memberId));
    const vencida = (f: (typeof fila)[number]) => f.avisadoEm && agora.getTime() - f.avisadoEm.getTime() > RESERVA_MS;
    const sair = fila.filter((f) => inscritos.has(f.memberId) || vencida(f)).map((f) => f.id);
    if (sair.length) await db.eventWaitlist.deleteMany({ where: { id: { in: sair } } });
    const restantes = fila.filter((f) => !sair.includes(f.id));
    if (e.registrationClosesAt && e.registrationClosesAt <= agora) continue;

    const ocupadas = (await db.eventRegistration.count({ where: { eventId: e.id } })) + restantes.filter((f) => f.avisadoEm).length;
    const livres = Math.max(0, (e.capacity ?? 0) - ocupadas);
    for (const f of restantes.filter((x) => !x.avisadoEm).slice(0, livres)) {
      const marcado = await db.eventWaitlist.updateMany({ where: { id: f.id, avisadoEm: null }, data: { avisadoEm: agora } });
      if (!marcado.count) continue;
      await enviarPush([f.memberId], {
        titulo: `Abriu uma vaga: ${e.title}`,
        corpo: "A vaga está reservada para você por 12 horas. Toque para se inscrever.",
        url: "/portal",
        etiqueta: `vaga-${e.id}`,
      }).catch(() => null);
      avisados++;
    }
  }
  return avisados;
}
