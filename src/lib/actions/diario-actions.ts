"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { datasPermitidas, epilogoValido, fogoInterno, fraseDoDia, somarDias, type Recorrencia } from "@/lib/diario";
import { hojeDaPessoa } from "@/lib/diario-dados";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

/** Diário filosófico (2026-10-29): cada ação grava só no diário de quem está logado, em hoje ou nos 3 dias anteriores. */
type Resultado = { ok: true } | { ok: false; error: string };

const texto = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "") || null;

async function pessoaEDia(data: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) throw new Error("Entre no Portal.");
  if (!datasPermitidas(hojeDaPessoa(eu)).includes(data)) throw new Error("Dá para preencher só hoje e os 3 dias anteriores.");
  return eu;
}

async function executar(fn: () => Promise<void>): Promise<Resultado> {
  try {
    await fn();
    revalidatePath("/diario");
    return { ok: true };
  } catch (e) {
    console.error("Diário:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error && !/prisma|database|invocation/i.test(e.message) ? e.message : "Não foi possível salvar agora. Tente de novo." };
  }
}

export async function salvarPrologo(data: string, entrada: { virtude: string; compromisso: string }): Promise<Resultado> {
  return executar(async () => {
    const eu = await pessoaEDia(data);
    const virtude = texto(entrada.virtude, 120);
    if (!virtude) throw new Error("Escolha ou escreva a virtude do dia.");
    const campos = { virtude, compromisso: texto(entrada.compromisso), frase: fraseDoDia(data), prologoEm: new Date() };
    await db.diarioDia.upsert({ where: { memberId_data: { memberId: eu.id, data } }, update: campos, create: { memberId: eu.id, data, ...campos } });
  });
}

export async function salvarEpilogo(data: string, entrada: { semPrologo: boolean; falhei: string; fizBem: string; deixeiDeFazer: string; reflexaoLivre: string }): Promise<Resultado> {
  return executar(async () => {
    const eu = await pessoaEDia(data);
    const campos = { semPrologo: !!entrada.semPrologo, falhei: texto(entrada.falhei), fizBem: texto(entrada.fizBem), deixeiDeFazer: texto(entrada.deixeiDeFazer), reflexaoLivre: texto(entrada.reflexaoLivre) };
    if (!epilogoValido(campos)) throw new Error("Responda às três perguntas ou escreva a reflexão livre.");
    await db.diarioDia.upsert({ where: { memberId_data: { memberId: eu.id, data } }, update: { ...campos, epilogoEm: new Date() }, create: { memberId: eu.id, data, ...campos, epilogoEm: new Date() } });
  });
}

export async function marcarPratica(data: string, praticaId: string, feita: boolean): Promise<Resultado> {
  return executar(async () => {
    const eu = await pessoaEDia(data);
    if (!(await db.diarioPratica.count({ where: { id: praticaId, memberId: eu.id } }))) throw new Error("Prática não encontrada.");
    await db.$transaction(async (tx) => {
      const dia = await tx.diarioDia.findUnique({ where: { memberId_data: { memberId: eu.id, data } }, select: { praticas: true } });
      const praticas = { ...((dia?.praticas ?? {}) as Record<string, boolean>) };
      if (feita) praticas[praticaId] = true;
      else delete praticas[praticaId];
      const valor = praticas as Prisma.InputJsonValue;
      await tx.diarioDia.upsert({ where: { memberId_data: { memberId: eu.id, data } }, update: { praticas: valor }, create: { memberId: eu.id, data, praticas: valor } });
    });
  });
}

export async function criarPratica(entrada: { nome: string; recorrencia: Recorrencia; diasSemana: number[]; diaMes: number | null }): Promise<Resultado> {
  return executar(async () => {
    const eu = await getAuthenticatedMember();
    if (!eu) throw new Error("Entre no Portal.");
    const nome = texto(entrada.nome, 120);
    if (!nome) throw new Error("Dê um nome à prática.");
    const recorrencia: Recorrencia = ["diaria", "semanal", "quinzenal", "mensal"].includes(entrada.recorrencia) ? entrada.recorrencia : "diaria";
    const diasSemana = recorrencia === "semanal" ? [...new Set(entrada.diasSemana.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
    if (recorrencia === "semanal" && !diasSemana.length) throw new Error("Escolha pelo menos um dia da semana.");
    const hoje = hojeDaPessoa(eu);
    const diaMes = recorrencia === "mensal" ? Math.min(31, Math.max(1, Math.round(entrada.diaMes ?? Number(hoje.slice(8))))) : null;
    if ((await db.diarioPratica.count({ where: { memberId: eu.id, arquivadaEm: null } })) >= 30) throw new Error("Limite de 30 práticas ativas.");
    await db.diarioPratica.create({ data: { memberId: eu.id, nome, recorrencia, diasSemana, diaMes, dataBase: hoje } });
  });
}

export async function arquivarPratica(praticaId: string): Promise<Resultado> {
  return executar(async () => {
    const eu = await getAuthenticatedMember();
    if (!eu) throw new Error("Entre no Portal.");
    const r = await db.diarioPratica.updateMany({ where: { id: praticaId, memberId: eu.id, arquivadaEm: null }, data: { arquivadaEm: new Date() } });
    if (!r.count) throw new Error("Prática não encontrada.");
  });
}

/** Situação de hoje para o cartão do diário (Prólogo, Epílogo, Fogo Interno), sem nenhum texto do diário. */
export async function estadoDoDiarioHoje(): Promise<{ prologo: boolean; epilogo: boolean; sequencia: number } | null> {
  const eu = await getAuthenticatedMember();
  if (!eu) return null;
  const hoje = hojeDaPessoa(eu);
  const [dia, comEpilogo] = await Promise.all([
    db.diarioDia.findUnique({ where: { memberId_data: { memberId: eu.id, data: hoje } }, select: { prologoEm: true, epilogoEm: true } }),
    db.diarioDia.findMany({ where: { memberId: eu.id, epilogoEm: { not: null }, data: { gte: somarDias(hoje, -400) } }, select: { data: true } }),
  ]);
  return { prologo: !!dia?.prologoEm, epilogo: !!dia?.epilogoEm, sequencia: fogoInterno(comEpilogo.map((d) => d.data), hoje).atual };
}
