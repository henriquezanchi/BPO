"use server";

import { conferirPagamento, criarMatricula } from "@/lib/matricula-online";
import { db } from "@/lib/db";
import { ZodError } from "zod";

/** Ações públicas do site de matrículas (sem login): enviar a matrícula e consultar o pagamento. */
export async function enviarMatricula(token: string, dados: unknown) {
  try {
    return { ok: true as const, ...(await criarMatricula(token, dados)) };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false as const, error: e.issues[0]?.message ?? "Confira os dados." };
    console.error("[Matrícula] falha", e instanceof Error ? e.message : e);
    return { ok: false as const, error: e instanceof Error && !e.message.startsWith("Asaas") ? e.message : "Não foi possível concluir agora. Tente de novo em instantes." };
  }
}

/** Consulta o pagamento só de uma matrícula da mesma abertura do link (o id sozinho não basta). */
export async function situacaoMatricula(token: string, id: string) {
  const m = await db.matriculaOnline.findFirst({ where: { id, abertura: { matriculaToken: token } }, select: { id: true } });
  if (!m) return { status: "nao_encontrada" };
  return { status: (await conferirPagamento(m.id).catch(() => null)) ?? "aguardando_pagamento" };
}
