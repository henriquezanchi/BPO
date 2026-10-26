import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { descadastrarTelefone, PEDIDO_DE_SAIDA, registrarSituacaoEnvio } from "@/lib/whatsapp/financeiro";
import { chamarZernio } from "@/lib/zernio/client";

/**
 * Avisos da Zernio (cadastrar com scripts/zernio-webhook.ts; segredo em ZERNIO_WEBHOOK_SECRET). Assinatura:
 * X-Zernio-Signature = HMAC-SHA256 do corpo cru, em hex. Entrega é "pelo menos uma vez": tudo aqui é idempotente.
 * - message.delivered/read/failed: situação dos envios do WhatsApp do financeiro (custo conta na entrega).
 * - message.received com "SAIR" no número central: tira o telefone da lista e confirma (grátis, janela de 24 h).
 * - account.connected/disconnected: Instagram das filiais (perfil da Zernio com externalId = School.id).
 */
export const dynamic = "force-dynamic";

type Aviso = {
  event?: string;
  profiles?: { id: string; externalId: string | null }[];
  message?: { id?: string; platformMessageId?: string; platform?: string; direction?: string; text?: string | null; conversationId?: string; sender?: { phoneNumber?: string | null } };
  conversation?: { id?: string; participantId?: string };
  account?: { id?: string; accountId?: string; platform?: string; username?: string; displayName?: string };
  metadata?: { buttonPayload?: string; quickReplyPayload?: string };
  error?: { message?: string; title?: string };
  statusAt?: string;
  timestamp?: string;
};

function assinaturaValida(corpo: string, recebida: string | null) {
  const segredo = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!segredo || !recebida) return false;
  const esperada = Buffer.from(createHmac("sha256", segredo).update(corpo).digest("hex"));
  const veio = Buffer.from(recebida.trim().toLowerCase());
  return esperada.length === veio.length && timingSafeEqual(esperada, veio);
}

export async function POST(req: Request) {
  if (!process.env.ZERNIO_WEBHOOK_SECRET) return new Response("webhook not configured", { status: 503 });
  const corpo = await req.text();
  if (!assinaturaValida(corpo, req.headers.get("x-zernio-signature"))) return new Response("unauthorized", { status: 401 });
  const aviso = JSON.parse(corpo) as Aviso;
  const evento = aviso.event ?? req.headers.get("x-zernio-event") ?? "";

  if (evento === "message.delivered" || evento === "message.read" || evento === "message.failed") {
    const quando = new Date(aviso.statusAt ?? aviso.timestamp ?? Date.now());
    await registrarSituacaoEnvio([aviso.message?.platformMessageId ?? "", aviso.message?.id ?? ""], evento, quando, aviso.error?.message ?? aviso.error?.title);
  } else if (evento === "message.received") {
    const numeroCentral = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID;
    const m = aviso.message;
    if (numeroCentral && aviso.account?.accountId === numeroCentral && m?.platform === "whatsapp" && PEDIDO_DE_SAIDA.test(m.text || aviso.metadata?.buttonPayload || aviso.metadata?.quickReplyPayload || "")) {
      const telefone = m.sender?.phoneNumber ?? aviso.conversation?.participantId ?? "";
      if (await descadastrarTelefone(telefone)) {
        const conversa = m.conversationId ?? aviso.conversation?.id;
        if (conversa)
          await chamarZernio(`/inbox/conversations/${conversa}/messages`, {
            method: "POST",
            body: JSON.stringify({ accountId: numeroCentral, message: "Pronto: você não vai mais receber as mensagens do financeiro da Nova Acrópole por aqui. Os avisos continuam no Portal do Membro." }),
          }).catch((e) => console.error("Zernio: falha ao confirmar a saída:", e));
      }
    }
  } else if (evento === "account.connected" || evento === "account.disconnected") {
    const schoolId = aviso.profiles?.[0]?.externalId;
    const rede = aviso.account?.platform;
    if (schoolId && rede === "instagram") {
      await db.redeSocialFilial.updateMany({
        where: { schoolId, rede, status: { not: "cancelada" } },
        data:
          evento === "account.connected"
            ? { status: "conectada", zernioAccountId: aviso.account?.accountId ?? null, usuario: aviso.account?.username ?? aviso.account?.displayName ?? null, conectadaEm: new Date() }
            : { status: "desconectada" },
      });
    }
  }
  return Response.json({ ok: true });
}
