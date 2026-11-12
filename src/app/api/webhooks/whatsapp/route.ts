import { descadastrarTelefone, PEDIDO_DE_SAIDA, registrarSituacaoEnvio } from "@/lib/whatsapp/financeiro";
import { AJUDA, membroPorTelefone, pedirContatoEconomia, pixPorWhatsapp } from "@/lib/whatsapp/conversa";
import { assinaturaMetaValida, enviarTextoMeta, lerPayload, metaConfigurado } from "@/lib/whatsapp/meta";

/**
 * Webhook do WhatsApp Cloud API (Meta), número do financeiro (12/11/2026). Cadastrar no app da Meta:
 * URL https://<portal>/api/webhooks/whatsapp, token de verificação = WHATSAPP_VERIFY_TOKEN, campo "messages".
 * - GET: verificação (hub.challenge).
 * - POST (assinado com WHATSAPP_APP_SECRET): situação dos envios (custo conta na entrega) e respostas das pessoas:
 *   botões "Quero o código Pix" / "Falar com a Economia" (payload assinado com a pessoa), PIX, ECONOMIA, SAIR e ajuda.
 * Respostas sempre 200 depois de validada a assinatura (a Meta reenvia o que não recebe 200).
 */
export const dynamic = "force-dynamic";

type Mensagem = {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
};
type Status = { id: string; status: string; timestamp?: string; errors?: { title?: string; message?: string }[] };
type Corpo = { entry?: { changes?: { field?: string; value?: { messages?: Mensagem[]; statuses?: Status[] } }[] }[] };

export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === token) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  if (!process.env.WHATSAPP_APP_SECRET) return new Response("webhook not configured", { status: 503 });
  const corpo = await req.text();
  if (!assinaturaMetaValida(corpo, req.headers.get("x-hub-signature-256"))) return new Response("unauthorized", { status: 401 });
  const dados = JSON.parse(corpo) as Corpo;

  for (const entrada of dados.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      const v = mudanca.value ?? {};
      for (const s of v.statuses ?? []) {
        const quando = new Date(Number(s.timestamp ?? 0) * 1000 || Date.now());
        const evento = s.status === "delivered" ? "message.delivered" : s.status === "read" ? "message.read" : s.status === "failed" ? "message.failed" : null;
        if (evento) await registrarSituacaoEnvio([s.id], evento, quando, s.errors?.[0]?.message ?? s.errors?.[0]?.title).catch((e) => console.error("WhatsApp: situação do envio:", e));
      }
      for (const m of v.messages ?? []) await responder(m).catch((e) => console.error("WhatsApp: falha ao responder:", (e as Error).message));
    }
  }
  return Response.json({ ok: true });
}

async function responder(m: Mensagem) {
  if (!metaConfigurado()) return;
  const payload = m.button?.payload ?? m.interactive?.button_reply?.id;
  const texto = (m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "").trim();
  const enviar = (t: string) => enviarTextoMeta(m.from, t);

  if (PEDIDO_DE_SAIDA.test(texto)) {
    await descadastrarTelefone(m.from);
    await enviar("Pronto: você não vai mais receber as mensagens do financeiro da Nova Acrópole por aqui. Os avisos continuam no Portal do Membro.");
    return;
  }

  // Botão de um modelo: a pessoa vem no payload, assinada. Mensagem digitada: a pessoa sai do número de telefone.
  const doBotao = lerPayload(payload);
  const acao = doBotao?.acao ?? (/^\s*pix\s*$/i.test(texto) ? "pix" : /^\s*economia\s*$/i.test(texto) ? "economia" : null);
  if (!acao) {
    await enviar(AJUDA);
    return;
  }
  const memberId = doBotao?.memberId ?? (await membroPorTelefone(m.from));
  if (!memberId) {
    await enviar("Não consegui identificar o seu cadastro por este número. Entre no Portal do Membro ou fale com a secretaria da sua filial.");
    return;
  }
  if (acao === "pix") {
    const r = await pixPorWhatsapp(memberId).catch((e) => {
      console.error("WhatsApp: Pix não gerado:", (e as Error).message);
      return { texto: "Não consegui gerar o Pix agora. Tente de novo em alguns minutos ou pague pelo Portal do Membro.", codigo: undefined };
    });
    await enviar(r.texto);
    if (r.codigo) await enviar(r.codigo);
  } else if (acao === "economia") {
    await enviar((await pedirContatoEconomia(memberId, m.from)).texto);
  }
}
