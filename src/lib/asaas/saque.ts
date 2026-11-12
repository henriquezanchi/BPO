import { db } from "@/lib/db";

/**
 * Saldo e saque da conta Asaas da filial (pedido do usuário 12/11/2026, Economia → Cobrança on-line).
 *
 * - O saque é uma transferência Pix da conta Asaas da filial para a chave Pix DA ESCOLA cadastrada no Portal.
 * - Chave do tipo CNPJ igual ao CNPJ da filial vale na hora; qualquer outra chave só vale depois de aprovada pelo dono
 *   do sistema (evita desvio para a conta de uma pessoa).
 * - Cada pedido fica registrado em ResumoNacional "saques:<schoolId>" ANTES de chamar o Asaas, e o webhook de validação
 *   de saque (api/webhooks/asaas-saque) só aprova transferência que o Portal pediu, com o mesmo valor.
 * - Gestão de contas a pagar da escola fica para depois (decisão do usuário).
 */
const BASE_URL = process.env.ASAAS_ENV === "sandbox" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";

async function api<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: { access_token: apiKey, "Content-Type": "application/json", "User-Agent": "portal-na", ...init?.headers },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { errors?: { description?: string }[] };
      msg = j.errors?.map((e) => e.description).filter(Boolean).join("; ") || msg;
    } catch {}
    throw Object.assign(new Error(`Asaas: ${msg}`), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export const TIPOS_CHAVE = { CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Telefone", EVP: "Chave aleatória" } as const;
export type TipoChave = keyof typeof TIPOS_CHAVE;
export type ChavePix = { tipo: TipoChave; chave: string; aprovada: boolean; cadastradaPor: string; em: string; aprovadaPor?: string };
export type Saque = {
  id: string;
  valor: number;
  chave: string;
  tipo: TipoChave;
  pedidoPor: string;
  em: string;
  status: "solicitado" | "aprovado" | "enviado" | "concluido" | "falhou" | "cancelado";
  transferId?: string;
  erro?: string;
};

const digitos = (s: string) => s.replace(/\D/g, "");

/** Normaliza e confere o formato da chave; devolve a chave limpa ou uma mensagem de erro. */
export function validarChave(tipo: TipoChave, chave: string): { ok: true; chave: string } | { ok: false; erro: string } {
  const c = chave.trim();
  if (tipo === "CNPJ") return digitos(c).length === 14 ? { ok: true, chave: digitos(c) } : { ok: false, erro: "CNPJ com 14 dígitos." };
  if (tipo === "EMAIL") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? { ok: true, chave: c.toLowerCase() } : { ok: false, erro: "E-mail inválido." };
  if (tipo === "PHONE") {
    const d = digitos(c);
    const n = d.length === 10 || d.length === 11 ? `+55${d}` : d.length >= 12 && d.startsWith("55") ? `+${d}` : null;
    return n ? { ok: true, chave: n } : { ok: false, erro: "Telefone com DDD." };
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c) ? { ok: true, chave: c.toLowerCase() } : { ok: false, erro: "Chave aleatória no formato do banco (32 letras e números com hífens)." };
}

/** A chave do tipo CNPJ igual ao CNPJ da filial dispensa aprovação. */
export const chaveDaPropriaEscola = (tipo: TipoChave, chave: string, cnpjEscola: string | null) => tipo === "CNPJ" && !!cnpjEscola && digitos(cnpjEscola) === chave;

export async function saldoDaConta(apiKey: string): Promise<number> {
  return Number((await api<{ balance: number }>(apiKey, "/finance/balance")).balance ?? 0);
}

const chaveSaques = (schoolId: string) => `saques:${schoolId}`;

export async function saquesDaEscola(schoolId: string): Promise<Saque[]> {
  const linha = await db.resumoNacional.findUnique({ where: { chave: chaveSaques(schoolId) } });
  return ((linha?.dados as { saques?: Saque[] } | null)?.saques ?? []).slice();
}

async function gravarSaques(schoolId: string, saques: Saque[]) {
  const dados = { saques: saques.slice(-100) };
  await db.resumoNacional.upsert({ where: { chave: chaveSaques(schoolId) }, update: { dados, geradoEm: new Date() }, create: { chave: chaveSaques(schoolId), dados } });
}

async function atualizarSaque(schoolId: string, id: string, mudanca: Partial<Saque>) {
  const lista = await saquesDaEscola(schoolId);
  await gravarSaques(schoolId, lista.map((s) => (s.id === id ? { ...s, ...mudanca } : s)));
}

const STATUS_ASAAS: Record<string, Saque["status"]> = { PENDING: "enviado", BANK_PROCESSING: "enviado", DONE: "concluido", CANCELLED: "cancelado", FAILED: "falhou" };

/** Pede o saque. Registra antes de chamar o Asaas (o webhook de validação confere esse registro). */
export async function pedirSaque(d: { schoolId: string; apiKey: string; valor: number; chave: ChavePix; pedidoPor: string; escola: string }): Promise<Saque> {
  const saque: Saque = { id: `s${Date.now().toString(36)}`, valor: d.valor, chave: d.chave.chave, tipo: d.chave.tipo, pedidoPor: d.pedidoPor, em: new Date().toISOString(), status: "solicitado" };
  await gravarSaques(d.schoolId, [...(await saquesDaEscola(d.schoolId)), saque]);
  try {
    const t = await api<{ id: string; status: string }>(d.apiKey, "/transfers", {
      method: "POST",
      body: JSON.stringify({ value: d.valor, operationType: "PIX", pixAddressKey: d.chave.chave, pixAddressKeyType: d.chave.tipo, description: `Saque pelo Portal — ${d.escola}`, externalReference: saque.id }),
    });
    const mudanca = { transferId: t.id, status: STATUS_ASAAS[t.status] ?? "enviado" } as const;
    await atualizarSaque(d.schoolId, saque.id, mudanca);
    return { ...saque, ...mudanca };
  } catch (e) {
    const erro = (e as Error).message.slice(0, 300);
    await atualizarSaque(d.schoolId, saque.id, { status: "falhou", erro });
    throw e;
  }
}

/** Atualiza a situação dos saques em andamento (consulta o Asaas). */
export async function conferirSaques(schoolId: string, apiKey: string): Promise<Saque[]> {
  const lista = await saquesDaEscola(schoolId);
  const abertos = lista.filter((s) => s.transferId && (s.status === "enviado" || s.status === "aprovado")).slice(-5);
  if (!abertos.length) return lista;
  let mudou = false;
  for (const s of abertos) {
    const t = await api<{ status: string; failReason?: string }>(apiKey, `/transfers/${s.transferId}`).catch(() => null);
    const novo = t ? STATUS_ASAAS[t.status] : undefined;
    if (novo && novo !== s.status) {
      s.status = novo;
      if (t?.failReason) s.erro = t.failReason.slice(0, 300);
      mudou = true;
    }
  }
  if (mudou) await gravarSaques(schoolId, lista);
  return lista;
}

/**
 * Para o webhook de validação de saque: aprova uma TRANSFER se houver saque "solicitado" do mesmo valor pedido pelo
 * Portal na última hora (e o marca como aprovado, para não servir de novo).
 */
export async function aprovarTransferenciaDoPortal(valor: number, transferId: string | undefined): Promise<boolean> {
  const desde = Date.now() - 60 * 60 * 1000;
  const linhas = await db.resumoNacional.findMany({ where: { chave: { startsWith: "saques:" }, geradoEm: { gte: new Date(desde) } } });
  for (const l of linhas) {
    const lista = ((l.dados as { saques?: Saque[] }).saques ?? []).slice();
    const alvo = lista.find(
      (s) => Date.parse(s.em) >= desde && Math.round(s.valor * 100) === Math.round(valor * 100) && (s.status === "solicitado" || (s.status === "enviado" && (!s.transferId || s.transferId === transferId))),
    );
    if (!alvo) continue;
    if (alvo.status === "solicitado") {
      alvo.status = "aprovado";
      if (transferId) alvo.transferId = transferId;
      await db.resumoNacional.update({ where: { chave: l.chave }, data: { dados: { saques: lista } } });
    }
    return true;
  }
  return false;
}
