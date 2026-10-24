"use server";

import { requireArea } from "@/lib/auth";
import { db } from "@/lib/db";
import { novoTokenTela } from "@/lib/telas-eventos";
import { validarPublicosTela } from "@/lib/telas-publicos";
import { revalidatePath } from "next/cache";

/** Telas de TV da filial (pedido do usuário 2026-10-24): quem cuida dos Eventos cria e ajusta. */
type Resultado = { ok: true } | { ok: false; error: string };

async function executar(acao: () => Promise<unknown>, falha: string): Promise<Resultado> {
  try {
    await acao();
    revalidatePath("/voluntario/eventos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error && !e.message.includes("prisma") ? e.message : falha };
  }
}

function validarNome(nome: string) {
  const n = nome.trim().replace(/\s+/g, " ");
  if (!n) throw Error("Dê um nome à tela (ex.: TV da recepção).");
  return n.slice(0, 60);
}

function garantir(count: number) {
  if (!count) throw Error("Tela não encontrada nesta filial.");
}

export async function criarTela(schoolId: string, nome: string, publicos: string[]) {
  return executar(async () => {
    const actor = await requireArea(schoolId, "eventos");
    await db.telaEventos.create({ data: { schoolId, nome: validarNome(nome), publicos: validarPublicosTela(publicos), token: novoTokenTela(), criadoPor: actor.id } });
  }, "Não foi possível criar a tela.");
}

export async function atualizarTela(schoolId: string, id: string, nome: string, publicos: string[]) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.telaEventos.updateMany({ where: { id, schoolId }, data: { nome: validarNome(nome), publicos: validarPublicosTela(publicos) } })).count);
  }, "Não foi possível salvar a tela.");
}

/** Troca o link: a TV com o link antigo para de mostrar os eventos. */
export async function trocarLinkTela(schoolId: string, id: string) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.telaEventos.updateMany({ where: { id, schoolId }, data: { token: novoTokenTela() } })).count);
  }, "Não foi possível trocar o link.");
}

export async function excluirTela(schoolId: string, id: string) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.telaEventos.deleteMany({ where: { id, schoolId } })).count);
  }, "Não foi possível excluir a tela.");
}
