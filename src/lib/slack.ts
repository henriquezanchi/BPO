/**
 * Integração com o Slack da filial (Web API, sem SDK). Cada filial que usa
 * Slack tem o seu próprio app instalado no workspace dela; o token do bot
 * fica SÓ em variável de ambiente do servidor — SLACK_BOT_TOKEN_<UNIDADE>
 * (ex: SLACK_BOT_TOKEN_GYN), nunca no banco nem no navegador.
 *
 * Escopos do bot: chat:write, channels:manage, groups:write, channels:read,
 * groups:read, users:read, users:read.email.
 */

export function tokenSlackDaFilial(mercurioUnidade: string | null | undefined): string | null {
  if (!mercurioUnidade) return null;
  return process.env[`SLACK_BOT_TOKEN_${mercurioUnidade.toUpperCase()}`] ?? null;
}

async function slack<T = Record<string, unknown>>(token: string, metodo: string, params: Record<string, string | boolean>): Promise<T & { ok: true }> {
  const res = await fetch(`https://slack.com/api/${metodo}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const json = (await res.json().catch(() => ({ ok: false, error: `http_${res.status}` }))) as { ok: boolean; error?: string };
  if (!json.ok) throw new ErroSlack(json.error ?? "erro_desconhecido");
  return json as T & { ok: true };
}

export class ErroSlack extends Error {
  constructor(public codigo: string) {
    super(`Slack: ${codigo}`);
  }
}

/** Mensagem amigável pros erros mais comuns da API. */
export function mensagemErroSlack(e: unknown): string {
  const codigo = e instanceof ErroSlack ? e.codigo : "";
  const msgs: Record<string, string> = {
    name_taken: "Já existe um canal com esse nome no Slack. Use \"Vincular canal existente\" e cole o link dele.",
    channel_not_found: "Canal não encontrado — confira o link e se o app do Portal foi adicionado ao canal (privado).",
    not_in_channel: "O app do Portal não está nesse canal. No Slack, abra o canal e adicione o app.",
    is_archived: "Esse canal está arquivado no Slack.",
    missing_scope: "O app do Slack da filial está sem permissão pra isso. Fale com quem administra o Slack.",
    invalid_auth: "O acesso do Portal ao Slack da filial expirou ou foi revogado.",
    ratelimited: "O Slack pediu pra aguardar um pouco. Tente de novo em instantes.",
  };
  return msgs[codigo] ?? "Não foi possível falar com o Slack agora. Tente de novo em alguns minutos.";
}

export function slugCanal(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function identificarWorkspace(token: string) {
  const r = await slack<{ team_id: string }>(token, "auth.test", {});
  return r.team_id;
}

export async function criarCanalPrivado(token: string, nome: string) {
  const r = await slack<{ channel: { id: string } }>(token, "conversations.create", { name: slugCanal(nome), is_private: true });
  return r.channel.id;
}

/** Confere que o bot enxerga o canal (público ou privado em que foi adicionado). Entra sozinho se for público. */
export async function verificarCanal(token: string, channelId: string) {
  const r = await slack<{ channel: { id: string; is_private: boolean; is_member: boolean; is_archived: boolean } }>(token, "conversations.info", { channel: channelId });
  if (r.channel.is_archived) throw new ErroSlack("is_archived");
  if (!r.channel.is_private && !r.channel.is_member) await slack(token, "conversations.join", { channel: channelId });
  return r.channel;
}

/** Extrai o ID do canal de um link do Slack (…/archives/C123… ou …/client/T…/C123…) ou do próprio ID. */
export function idDoCanal(linkOuId: string): string | null {
  const t = linkOuId.trim();
  const m = t.match(/\/(?:archives|client\/[A-Z0-9]+)\/([CG][A-Z0-9]{6,})/) ?? t.match(/^([CG][A-Z0-9]{6,})$/);
  return m?.[1] ?? null;
}

/** Busca o usuário do Slack pelo e-mail; null se a pessoa não tem conta nesse workspace. */
export async function usuarioPorEmail(token: string, email: string): Promise<string | null> {
  try {
    const r = await slack<{ user: { id: string; deleted?: boolean } }>(token, "users.lookupByEmail", { email });
    return r.user.deleted ? null : r.user.id;
  } catch (e) {
    if (e instanceof ErroSlack && e.codigo === "users_not_found") return null;
    throw e;
  }
}

/** Convida vários usuários de uma vez; `force` ignora quem já está no canal em vez de falhar tudo. */
export async function convidarParaCanal(token: string, channelId: string, userIds: string[]) {
  for (let i = 0; i < userIds.length; i += 100) {
    const lote = userIds.slice(i, i + 100);
    try {
      await slack(token, "conversations.invite", { channel: channelId, users: lote.join(","), force: true });
    } catch (e) {
      if (!(e instanceof ErroSlack && e.codigo === "already_in_channel")) throw e;
    }
  }
}

export async function postarNoCanal(token: string, channelId: string, texto: string) {
  await slack(token, "chat.postMessage", { channel: channelId, text: texto, unfurl_links: false });
}

export function linkDoCanal(teamId: string | null, channelId: string | null) {
  return teamId && channelId ? `https://app.slack.com/client/${teamId}/${channelId}` : null;
}
