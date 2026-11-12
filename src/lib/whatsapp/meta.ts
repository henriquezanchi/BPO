import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp Cloud API direto na Meta (12/11/2026). A empresa do usuário é tech provider, então o número do financeiro
 * não passa pela Zernio. Variáveis (só no servidor, nunca NEXT_PUBLIC_):
 * - WHATSAPP_PHONE_NUMBER_ID: id do número do financeiro no Gerenciador do WhatsApp;
 * - WHATSAPP_TOKEN: token de acesso permanente (usuário do sistema) com whatsapp_business_messaging;
 * - WHATSAPP_APP_SECRET: segredo do app da Meta (confere a assinatura do webhook e assina os botões);
 * - WHATSAPP_VERIFY_TOKEN: texto livre combinado no cadastro do webhook;
 * - WHATSAPP_WABA_ID: conta do WhatsApp Business (só para cadastrar os modelos: scripts/whatsapp-modelos-meta.ts);
 * - WHATSAPP_GRAPH_VERSION (opcional, padrão v23.0).
 * Sem número e token, nada sai: o resto do Portal segue igual.
 */
const versao = () => process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
export const metaConfigurado = () => !!process.env.WHATSAPP_PHONE_NUMBER_ID && !!process.env.WHATSAPP_TOKEN;

export class ErroMeta extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo?: number,
  ) {
    super(message);
  }
}

export async function chamarGraph<T>(caminho: string, corpo?: unknown, metodo = "POST"): Promise<T> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new ErroMeta("WhatsApp não configurado.", 0);
  const r = await fetch(`https://graph.facebook.com/${versao()}/${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_user_msg?: string } } & T;
  if (!r.ok || j.error) throw new ErroMeta(j.error?.error_user_msg || j.error?.message || `HTTP ${r.status}`, r.status, j.error?.code);
  return j;
}

type RespostaEnvio = { messages?: { id: string }[] };
const numero = () => process.env.WHATSAPP_PHONE_NUMBER_ID!;

/** Modelo aprovado (fora da janela de 24 h). `botoes`: payload de cada botão de resposta rápida, na ordem do modelo. */
export async function enviarModeloMeta(d: { telefone: string; modelo: string; idioma: string; parametros: string[]; botoes?: string[] }) {
  const components: unknown[] = [];
  if (d.parametros.length) components.push({ type: "body", parameters: d.parametros.map((text) => ({ type: "text", text })) });
  (d.botoes ?? []).forEach((payload, index) => components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] }));
  const r = await chamarGraph<RespostaEnvio>(`${numero()}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: d.telefone,
    type: "template",
    template: { name: d.modelo, language: { code: d.idioma }, components },
  });
  return { messageId: r.messages?.[0]?.id ?? "" };
}

/** Texto livre: só vale dentro da janela de 24 h aberta pela pessoa (resposta a um botão ou mensagem dela). */
export async function enviarTextoMeta(telefone: string, texto: string) {
  const r = await chamarGraph<RespostaEnvio>(`${numero()}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: telefone,
    type: "text",
    text: { body: texto.slice(0, 4096), preview_url: false },
  });
  return { messageId: r.messages?.[0]?.id ?? "" };
}

/** Até 3 botões de resposta (janela de 24 h). */
export async function enviarBotoesMeta(telefone: string, texto: string, botoes: { id: string; titulo: string }[]) {
  const r = await chamarGraph<RespostaEnvio>(`${numero()}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: telefone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: texto.slice(0, 1024) },
      action: { buttons: botoes.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: b.titulo.slice(0, 20) } })) },
    },
  });
  return { messageId: r.messages?.[0]?.id ?? "" };
}

/** Assinatura do webhook: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(corpo cru, segredo do app). */
export function assinaturaMetaValida(corpo: string, cabecalho: string | null) {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (!segredo || !cabecalho?.startsWith("sha256=")) return false;
  const esperada = Buffer.from(createHmac("sha256", segredo).update(corpo).digest("hex"));
  const veio = Buffer.from(cabecalho.slice(7).trim().toLowerCase());
  return esperada.length === veio.length && timingSafeEqual(esperada, veio);
}

/**
 * Payload dos botões: "acao:memberId:assinatura". A assinatura (HMAC com o segredo do app) impede que alguém monte
 * um payload para gerar cobrança de outra pessoa.
 */
const assinar = (base: string) => createHmac("sha256", process.env.WHATSAPP_APP_SECRET ?? "sem-segredo").update(base).digest("hex").slice(0, 16);
export const payloadBotao = (acao: string, memberId: string) => `${acao}:${memberId}:${assinar(`${acao}:${memberId}`)}`;
export function lerPayload(payload: string | undefined | null): { acao: string; memberId: string } | null {
  const [acao, memberId, sig] = (payload ?? "").split(":");
  if (!acao || !memberId || !sig) return null;
  const esperado = Buffer.from(assinar(`${acao}:${memberId}`));
  const veio = Buffer.from(sig);
  return esperado.length === veio.length && timingSafeEqual(esperado, veio) ? { acao, memberId } : null;
}
