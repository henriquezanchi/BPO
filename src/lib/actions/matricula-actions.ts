"use server";

import { conferirPagamentoDaTela, criarMatricula, MatriculaErro } from "@/lib/matricula-online";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { ZodError } from "zod";

/** Ações públicas do site de matrículas (sem login): enviar a matrícula e consultar o pagamento. */
export async function enviarMatricula(token: string, dados: unknown) {
  try {
    if (!(await pareceHumano(dados))) return { ok: false as const, error: "Confirme a verificação de segurança e envie de novo." };
    return { ok: true as const, ...(await criarMatricula(token, dados)) };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false as const, error: e.issues[0]?.message ?? "Confira os dados." };
    console.error("[Matrícula] falha", e instanceof Error ? e.message : e);
    // Só mensagens próprias da matrícula chegam ao visitante; erro de banco, rede ou Asaas vira mensagem genérica.
    return { ok: false as const, error: e instanceof MatriculaErro ? e.message : "Não foi possível concluir agora. Tente de novo em instantes." };
  }
}

/** Consulta o pagamento só de uma matrícula da mesma abertura do link (o id sozinho não basta). */
export async function situacaoMatricula(token: string, id: string) {
  const m = await db.matriculaOnline.findFirst({ where: { id, abertura: { matriculaToken: token } }, select: { id: true } });
  if (!m) return { status: "nao_encontrada" };
  return { status: (await conferirPagamentoDaTela(m.id).catch(() => null)) ?? "aguardando_pagamento" };
}

/**
 * Verificação contra robôs (Cloudflare Turnstile, 01/11/2026): o site é público e cada matrícula cria cliente e
 * cobrança de verdade na subconta. Só vale com TURNSTILE_SECRET_KEY na Vercel (e NEXT_PUBLIC_TURNSTILE_SITE_KEY para o
 * quadro aparecer no formulário); sem as chaves, continua só o campo-isca.
 */
async function pareceHumano(dados: unknown) {
  const segredo = process.env.TURNSTILE_SECRET_KEY;
  if (!segredo) return true;
  const resposta = dados && typeof dados === "object" ? (dados as Record<string, unknown>)["cf-turnstile-response"] : null;
  if (typeof resposta !== "string" || !resposta) return false;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: segredo, response: resposta, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch {
    // Cloudflare fora do ar não fecha as matrículas.
    return true;
  }
}
