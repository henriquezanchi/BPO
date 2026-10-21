import { db } from "@/lib/db";
import webpush from "web-push";

/**
 * Notificações push do PWA (pedido do usuário 2026-10-21: "como ainda não
 * temos o app, prepare a versão PWA"). Chaves VAPID só no servidor
 * (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY); a pública chega ao navegador por
 * chavePublicaPush() em push-actions.ts, sem NEXT_PUBLIC_.
 *
 * Sem as chaves configuradas, nada é enviado e ninguém é avisado de erro: o
 * Portal continua funcionando só com os avisos na tela.
 */
export type AvisoPush = {
  titulo: string;
  corpo: string;
  /** Endereço aberto ao tocar na notificação (interno, como "/portal", ou o link da chamada). */
  url?: string;
  /** Notificações com a mesma etiqueta se substituem no aparelho em vez de empilhar. */
  etiqueta?: string;
};

let configurado: boolean | null = null;

function configurar() {
  if (configurado !== null) return configurado;
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return (configurado = false);
  // O "subject" identifica o remetente para os serviços de push (Google, Apple, Mozilla).
  webpush.setVapidDetails(process.env.PUSH_SUBJECT ?? "https://portal-na-one.vercel.app", publica, privada);
  return (configurado = true);
}

export function pushConfigurado() {
  return configurar();
}

/**
 * Envia para todos os aparelhos inscritos das pessoas indicadas. Devolve
 * quantas pessoas receberam em pelo menos um aparelho. Inscrições que o
 * serviço de push declara vencidas (404/410) são apagadas.
 */
export async function enviarPush(memberIds: string[], aviso: AvisoPush): Promise<{ pessoas: number; aparelhos: number }> {
  if (!memberIds.length || !configurar()) return { pessoas: 0, aparelhos: 0 };
  const inscricoes = await db.pushSubscription.findMany({ where: { memberId: { in: [...new Set(memberIds)] } } });
  if (!inscricoes.length) return { pessoas: 0, aparelhos: 0 };

  const carga = JSON.stringify({ title: aviso.titulo, body: aviso.corpo, url: aviso.url ?? "/portal", tag: aviso.etiqueta });
  const vencidas: string[] = [];
  const entregues: { id: string; memberId: string }[] = [];
  await Promise.all(
    inscricoes.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 60 * 60 * 12, urgency: "high" });
        entregues.push(s);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) vencidas.push(s.id);
        else console.error("Falha ao enviar push:", status ?? e);
      }
    }),
  );
  if (vencidas.length) await db.pushSubscription.deleteMany({ where: { id: { in: vencidas } } });
  if (entregues.length) await db.pushSubscription.updateMany({ where: { id: { in: entregues.map((s) => s.id) } }, data: { ultimoEnvioEm: new Date() } });
  return { pessoas: new Set(entregues.map((s) => s.memberId)).size, aparelhos: entregues.length };
}

/** Versão "dispara e esquece" para ações do usuário: uma falha no push nunca desfaz a ação. */
export function avisarSemEsperar(memberIds: string[], aviso: AvisoPush) {
  return enviarPush(memberIds, aviso).catch((e) => {
    console.error("Falha ao enviar push:", e);
    return { pessoas: 0, aparelhos: 0 };
  });
}
