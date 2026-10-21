"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enviarPush, pushConfigurado } from "@/lib/push";

/** Chave pública VAPID para o navegador se inscrever (não é segredo; fica fora de NEXT_PUBLIC_ para não depender do build). */
export async function chavePublicaPush(): Promise<string | null> {
  return pushConfigurado() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
}

type InscricaoNavegador = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Guarda a inscrição deste aparelho para a pessoa logada (o mesmo aparelho trocado de conta passa para a nova). */
export async function salvarInscricaoPush(inscricao: InscricaoNavegador, userAgent?: string) {
  const member = await getAuthenticatedMember();
  if (!member) throw new Error("Sessão expirada. Entre de novo.");
  if (!/^https:\/\//.test(inscricao.endpoint) || !inscricao.keys?.p256dh || !inscricao.keys?.auth) throw new Error("Inscrição inválida.");
  const dados = { memberId: member.id, p256dh: inscricao.keys.p256dh, auth: inscricao.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null };
  await db.pushSubscription.upsert({ where: { endpoint: inscricao.endpoint }, update: dados, create: { ...dados, endpoint: inscricao.endpoint } });
  return { ok: true };
}

export async function removerInscricaoPush(endpoint: string) {
  const member = await getAuthenticatedMember();
  if (!member) return { ok: true };
  await db.pushSubscription.deleteMany({ where: { endpoint, memberId: member.id } });
  return { ok: true };
}

/** Notificação de teste para a própria pessoa — confirma que o aparelho recebe. */
export async function enviarNotificacaoTeste() {
  const member = await getAuthenticatedMember();
  if (!member) throw new Error("Sessão expirada. Entre de novo.");
  const r = await enviarPush([member.id], { titulo: "Notificações ativadas", corpo: "Você vai receber aqui os avisos do Portal da Nova Acrópole.", url: "/portal", etiqueta: "teste" });
  return { ok: r.aparelhos > 0 };
}
