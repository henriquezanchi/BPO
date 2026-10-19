"use server";

import { requireArea } from "@/lib/auth";
import type { Publico } from "@/lib/calendario-comum";
import { conflitosDoHorario, itensDoCalendario, sugerirJanelas } from "@/lib/calendario-filial";

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
  const itens = await itensDoCalendario(schoolId, new Date(inicio.getTime() - 86400000), new Date(fim.getTime() + 86400000));
  return conflitosDoHorario(itens, inicio, fim, publicos);
}

export async function sugerirDatas(
  schoolId: string,
  opcoes: { publicos: Publico[]; duracaoMin: number; semanas: number; dias: number[]; horarios: string[] },
) {
  await requireArea(schoolId, "eventos", "direcao");
  const semanas = Math.min(Math.max(opcoes.semanas, 1), 16);
  const de = new Date(Date.now() + 2 * 86400000); // a partir de depois de amanhã
  const ate = new Date(de.getTime() + semanas * 7 * 86400000 + 86400000);
  const itens = await itensDoCalendario(schoolId, de, ate);
  return sugerirJanelas(itens, {
    publicos: opcoes.publicos,
    duracaoMin: Math.min(Math.max(opcoes.duracaoMin, 30), 12 * 60),
    de,
    semanas,
    dias: opcoes.dias.filter((d) => d >= 0 && d <= 6),
    horarios: opcoes.horarios.filter((h) => /^\d{2}:\d{2}$/.test(h)),
  });
}
