/**
 * Zernio (https://docs.zernio.com): integradora de WhatsApp e Instagram (pedido do usuário 2026-10-26).
 * - WhatsApp: um número central do financeiro para toda a rede (ZERNIO_WHATSAPP_ACCOUNT_ID); só mensagens de
 *   utilidade com modelos aprovados pela Meta (ver lib/whatsapp/modelos.ts).
 * - Instagram: pacote opcional da filial; cada filial é um "perfil" da Zernio (externalId = School.id).
 * Chave só no servidor (ZERNIO_API_KEY). Sem a chave, nada é chamado.
 */
const BASE = "https://zernio.com/api/v1";

export class ErroZernio extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo?: string,
    readonly details?: { existingProfileId?: string },
  ) {
    super(message);
  }
}

export const zernioConfigurado = () => !!process.env.ZERNIO_API_KEY;

export async function chamarZernio<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const chave = process.env.ZERNIO_API_KEY;
  if (!chave) throw new ErroZernio("Integração com a Zernio não configurada.", 0);
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
  const corpo = (await r.json().catch(() => null)) as { error?: string; code?: string; details?: { existingProfileId?: string } } | null;
  if (!r.ok) throw new ErroZernio(corpo?.error ?? `Zernio respondeu ${r.status}`, r.status, corpo?.code, corpo?.details);
  return corpo as T;
}

// ---- Perfis (um por filial) e conexão de contas ----

type Perfil = { _id: string; name: string; externalId: string | null };

/** Perfil da filial na Zernio; cria na primeira vez (o 409 de externalId repetido devolve o já existente). */
export async function perfilDaFilial(schoolId: string, nome: string): Promise<string> {
  const achados = await chamarZernio<{ profiles: Perfil[] }>(`/profiles?externalId=${encodeURIComponent(schoolId)}`);
  const existente = achados.profiles.find((p) => p.externalId === schoolId);
  if (existente) return existente._id;
  try {
    const criado = await chamarZernio<{ profile: Perfil }>("/profiles", { method: "POST", body: JSON.stringify({ name: nome, externalId: schoolId }) });
    return criado.profile._id;
  } catch (e) {
    const id = e instanceof ErroZernio ? e.details?.existingProfileId : undefined;
    if (id) return id;
    throw e;
  }
}

/** Endereço de autorização da rede para a filial; volta para `retorno` ao terminar. */
export async function linkDeConexao(rede: "instagram" | "whatsapp", profileId: string, retorno: string) {
  const q = new URLSearchParams({ profileId, redirect_url: retorno });
  const r = await chamarZernio<{ authUrl: string }>(`/connect/${rede}?${q}`);
  return r.authUrl;
}

export type ContaZernio = { _id: string; platform: string; username?: string; displayName?: string; profileId?: string | { _id: string } };

export async function contasDoPerfil(profileId: string) {
  const r = await chamarZernio<{ accounts: ContaZernio[] }>(`/accounts?profileId=${encodeURIComponent(profileId)}`);
  return r.accounts;
}

// ---- WhatsApp ----

/** Envia um modelo aprovado (utilidade) para um telefone; devolve o id da mensagem para casar com os avisos de entrega. */
export async function enviarModeloWhatsapp(opcoes: { accountId: string; telefone: string; modelo: string; idioma: string; parametros: string[] }) {
  const r = await chamarZernio<{ data?: { messageId?: string; conversationId?: string } }>("/inbox/conversations", {
    method: "POST",
    body: JSON.stringify({
      accountId: opcoes.accountId,
      participantId: opcoes.telefone,
      templateName: opcoes.modelo,
      templateLanguage: opcoes.idioma,
      templateParams: opcoes.parametros,
    }),
  });
  return { messageId: r.data?.messageId ?? null, conversationId: r.data?.conversationId ?? null };
}

// ---- Instagram ----

/** Publica (ou agenda) no Instagram da filial. `midias`: URLs públicas HTTPS (imagem JPEG/PNG). */
export async function publicarInstagram(opcoes: { accountId: string; legenda: string; midias: string[]; story?: boolean; agendarPara?: string; fuso?: string }) {
  const r = await chamarZernio<{ post?: { _id: string; status?: string } }>("/posts", {
    method: "POST",
    body: JSON.stringify({
      content: opcoes.legenda,
      mediaItems: opcoes.midias.map((url) => ({ url, type: "image" })),
      ...(opcoes.agendarPara ? { scheduledFor: opcoes.agendarPara, timezone: opcoes.fuso ?? "America/Sao_Paulo" } : { publishNow: true }),
      platforms: [{ platform: "instagram", accountId: opcoes.accountId, ...(opcoes.story ? { platformSpecificData: { contentType: "story" } } : {}) }],
    }),
  });
  return r.post?._id ?? null;
}
