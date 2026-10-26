import "server-only";
import { asaasFindOrCreateCustomer } from "@/lib/asaas/client";
import { splitDoBpo } from "@/lib/asaas/split";

/**
 * Cobrança emitida pela SUBCONTA Asaas da filial (pedido do usuário 2026-10-25: "deve ser na subconta da escola,
 * para que saia o nome de cada filial na cobrança"). Usa a chave da própria subconta (School.asaasSubaccountApiKey);
 * sem ela, a filial não cobra pelo site. Desde 2026-10-25 TODA cobrança do Portal segue esta regra (asaas/conta-escola.ts);
 * aqui ficam só as chamadas próprias do site (cobrança em aberto: Pix, cartão ou boleto).
 */
const BASE_URL = process.env.ASAAS_ENV === "sandbox" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";

async function api<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(20_000),
    headers: { access_token: apiKey, "Content-Type": "application/json", "User-Agent": "portal-na", ...init?.headers },
  });
  if (!res.ok) throw Object.assign(new Error(`Asaas (subconta) ${path} -> HTTP ${res.status}: ${await res.text()}`), { status: res.status });
  return res.json() as Promise<T>;
}

export type CobrancaSubconta = { id: string; status: string; invoiceUrl: string; value: number; paymentDate?: string | null; clientPaymentDate?: string | null };

/** Cliente na subconta, com as notificações do Asaas desligadas (o Portal avisa por conta própria). */
export async function clienteNaSubconta(apiKey: string, d: { nome: string; cpf: string; email: string; celular: string }) {
  return (await asaasFindOrCreateCustomer(d.nome, d.cpf, d.email, { apiKey })).id;
}

/** Cobrança em aberto para a pessoa escolher Pix, cartão ou boleto (página do Asaas); o Pix também aparece na tela. */
export async function cobrancaNaSubconta(apiKey: string, d: { customerId: string; valor: number; descricao: string; vencimento: string; referencia: string }) {
  // A margem do BPO volta para a conta principal por split, como nas demais cobranças (asaas/split.ts).
  const split = await splitDoBpo(d.valor, { apiKey });
  return api<CobrancaSubconta>(apiKey, "/payments", {
    method: "POST",
    body: JSON.stringify({ customer: d.customerId, billingType: "UNDEFINED", value: d.valor, dueDate: d.vencimento, description: d.descricao, externalReference: d.referencia, ...(split.length ? { split } : {}) }),
  });
}

export async function pixDaCobranca(apiKey: string, paymentId: string) {
  return api<{ encodedImage: string; payload: string; expirationDate: string }>(apiKey, `/payments/${paymentId}/pixQrCode`);
}

export async function situacaoDaCobranca(apiKey: string, paymentId: string) {
  return api<CobrancaSubconta>(apiKey, `/payments/${paymentId}`);
}

export const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
