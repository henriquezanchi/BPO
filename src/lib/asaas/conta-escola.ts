import { db } from "@/lib/db";
import type { ContaAsaas } from "@/lib/asaas/client";

/**
 * Regra do usuário (2026-10-25, prioridade): toda cobrança sai SEMPRE pela subconta Asaas da filial
 * (School.asaasSubaccountApiKey), para o aluno ver o nome da Nova Acrópole e nunca o da conta principal, que é a
 * empresa do BPO. Sem a chave da subconta a filial não cobra on-line: nada de cair na conta principal.
 * A margem do BPO volta para a conta principal por split (asaas/split.ts).
 */

export const MENSAGEM_CONTA_PENDENTE =
  "O pagamento on-line desta escola ainda não foi liberado: falta ligar a conta Asaas da filial. Fale com a Economia.";

export class ContaEscolaPendente extends Error {
  constructor() {
    super(MENSAGEM_CONTA_PENDENTE);
  }
}

type EscolaComConta = { asaasSubaccountApiKey: string | null };

/** Conta para EMITIR cobrança: obrigatoriamente a subconta da filial. */
export function contaDaEscola(escola: EscolaComConta): ContaAsaas {
  if (!escola.asaasSubaccountApiKey) throw new ContaEscolaPendente();
  return { apiKey: escola.asaasSubaccountApiKey };
}

export async function contaDaEscolaId(schoolId: string): Promise<ContaAsaas> {
  return contaDaEscola(await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { asaasSubaccountApiKey: true } }));
}

export const escolaCobraOnline = (escola: EscolaComConta) => !!escola.asaasSubaccountApiKey;

/**
 * Conta para CONSULTAR, estornar ou excluir uma cobrança já emitida: a subconta, se houver (o cliente cai na conta
 * principal quando a cobrança é antiga, emitida antes da regra); sem subconta, a principal (cobranças antigas).
 */
export function contaDeLeitura(escola: EscolaComConta | null | undefined): ContaAsaas | undefined {
  return escola?.asaasSubaccountApiKey ? { apiKey: escola.asaasSubaccountApiKey } : undefined;
}

export async function contaDeLeituraId(schoolId: string | null | undefined): Promise<ContaAsaas | undefined> {
  if (!schoolId) return undefined;
  return contaDeLeitura(await db.school.findUnique({ where: { id: schoolId }, select: { asaasSubaccountApiKey: true } }));
}

let walletCache: Promise<string> | null = null;

/** walletId da conta principal (destino da margem do BPO). ASAAS_WALLET_ID_PRINCIPAL evita a consulta. */
export function walletPrincipal(): Promise<string> {
  if (process.env.ASAAS_WALLET_ID_PRINCIPAL) return Promise.resolve(process.env.ASAAS_WALLET_ID_PRINCIPAL);
  walletCache ??= (async () => {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) throw new Error("ASAAS_API_KEY não configurado.");
    const base = process.env.ASAAS_ENV === "sandbox" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
    const res = await fetch(`${base}/wallets`, { headers: { access_token: apiKey, "User-Agent": "portal-na" }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw Object.assign(new Error(`Asaas API /wallets -> HTTP ${res.status}`), { status: res.status });
    const id = ((await res.json()) as { data?: { id: string }[] }).data?.[0]?.id;
    if (!id) throw new Error("Asaas não devolveu a carteira da conta principal.");
    return id;
  })().catch((e) => {
    walletCache = null;
    throw e;
  });
  return walletCache;
}

/**
 * Pix Automático liberado na subconta da filial (27/10/2026): o Asaas não habilita o recurso em toda subconta (BGA
 * respondeu "O Pix Automático não está disponível para sua conta no momento"). Lista de unidades do Mercúrio em
 * PIX_AUTOMATICO_UNIDADES (ex.: "BGA,GYN"); sem a variável, ninguém vê a opção.
 */
export function pixAutomaticoLiberado(unidade: string | null | undefined) {
  if (!unidade) return false;
  return (process.env.PIX_AUTOMATICO_UNIDADES ?? "").split(",").map((u) => u.trim().toUpperCase()).includes(unidade.toUpperCase());
}
