"use server";

import { requireArea } from "@/lib/auth";
import type { Publico } from "@/lib/calendario-comum";
import { conflitosDoHorario, itensDoCalendario, sugerirJanelas } from "@/lib/calendario-filial";
import { db } from "@/lib/db";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { revalidatePath } from "next/cache";

/** Fuso da filial: "mesmo dia" e horários sugeridos contam no relógio dela (31/10/2026). */
const fusoDaFilial = async (schoolId: string) => fusoDaEscola((await db.school.findUnique({ where: { id: schoolId }, select: { uf: true } }))?.uf);

/** Mês inteiro (com uma semana de folga de cada lado, pra grade do calendário). */
export async function getCalendarioMes(schoolId: string, ano: number, mes: number) {
  await requireArea(schoolId, "eventos", "direcao");
  const de = new Date(Date.UTC(ano, mes - 1, 1) - 7 * 86400000);
  const ate = new Date(Date.UTC(ano, mes, 1) + 7 * 86400000);
  return itensDoCalendario(schoolId, de, ate);
}

/** Conflitos de um horário (usado no cadastro de evento e no planejador). */
export async function verificarConflitos(schoolId: string, inicioISO: string, fimISO: string, publicos: Publico[]) {
  await requireArea(schoolId, "eventos", "direcao");
  const inicio = new Date(inicioISO);
  const fim = new Date(fimISO);
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || fim <= inicio) return [];
  const [itens, fuso] = await Promise.all([itensDoCalendario(schoolId, new Date(inicio.getTime() - 86400000), new Date(fim.getTime() + 86400000)), fusoDaFilial(schoolId)]);
  return conflitosDoHorario(itens, inicio, fim, publicos, fuso);
}

export async function sugerirDatas(
  schoolId: string,
  opcoes: { publicos: Publico[]; duracaoMin: number; semanas: number; dias: number[]; horarios: string[] },
) {
  await requireArea(schoolId, "eventos", "direcao");
  const semanas = Math.min(Math.max(opcoes.semanas, 1), 16);
  const de = new Date(Date.now() + 2 * 86400000); // a partir de depois de amanhã
  const ate = new Date(de.getTime() + semanas * 7 * 86400000 + 86400000);
  const [itens, fuso] = await Promise.all([itensDoCalendario(schoolId, de, ate), fusoDaFilial(schoolId)]);
  return sugerirJanelas(itens, {
    publicos: opcoes.publicos,
    duracaoMin: Math.min(Math.max(opcoes.duracaoMin, 30), 12 * 60),
    de,
    semanas,
    dias: opcoes.dias.filter((d) => d >= 0 && d <= 6),
    horarios: opcoes.horarios.filter((h) => /^\d{2}:\d{2}$/.test(h)),
  }, fuso);
}

/**
 * Período sem reuniões (recesso; pedido do usuário 24/11/2026): reuniões agendadas de todos os grupos da filial entre
 * duas datas (AAAA-MM-DD, horário de Brasília), para a direção escolher quais cancela e quais seguem.
 */
export async function reunioesDoPeriodo(schoolId: string, de: string, ate: string) {
  await requireArea(schoolId, "eventos", "direcao");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || ate < de) throw new Error("Período inválido.");
  const grupos = await db.classGroup.findMany({ where: { schoolId, arquivadoEm: null }, select: { id: true, name: true } });
  const nomes = new Map(grupos.map((g) => [g.id, g.name]));
  const reunioes = await db.groupMeeting.findMany({
    where: { classGroupId: { in: grupos.map((g) => g.id) }, status: "agendada", startsAt: { gte: new Date(`${de}T00:00:00-03:00`), lte: new Date(`${ate}T23:59:59-03:00`) } },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true, version: true, classGroupId: true },
  });
  return reunioes.filter((r) => r.startsAt > new Date()).map((r) => ({ id: r.id, titulo: r.title, inicio: r.startsAt.toISOString(), version: r.version, grupo: nomes.get(r.classGroupId) ?? "—" }));
}

/** Cancela em lote as reuniões escolhidas (só futuras, da própria filial), com o motivo; registra na auditoria de cada uma. */
export async function cancelarReunioesEmLote(schoolId: string, ids: string[], motivo: string) {
  const eu = await requireArea(schoolId, "eventos", "direcao");
  const razao = String(motivo ?? "").trim().slice(0, 300) || "Recesso";
  const alvo = await db.groupMeeting.findMany({ where: { id: { in: ids.slice(0, 500) }, status: "agendada", startsAt: { gt: new Date() }, classGroup: { schoolId } }, include: { responses: true } });
  const grupos = new Set<string>();
  await db.$transaction(
    async (tx) => {
      for (const r of alvo) {
        await tx.groupMeeting.update({ where: { id: r.id }, data: { status: "cancelada", cancellationReason: razao, version: { increment: 1 } } });
        await tx.groupMeetingAudit.create({
          data: {
            meetingId: r.id,
            actorId: eu.id,
            action: "cancelada",
            changes: {
              before: { title: r.title, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() },
              after: { reason: razao, lote: "recesso" },
              previousResponses: r.responses.map((x) => ({ memberId: x.memberId, response: x.response, justification: x.justification, updatedAt: x.updatedAt.toISOString() })),
            },
          },
        });
        grupos.add(r.classGroupId);
      }
    },
    { timeout: 30000 },
  );
  for (const g of grupos) revalidatePath(`/grupos/${g}`);
  revalidatePath("/portal");
  return { canceladas: alvo.length };
}
