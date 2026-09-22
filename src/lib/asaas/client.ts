/**
 * Cliente da API REST do Asaas (gateway de pagamento) — API JSON normal,
 * sem OAuth (autenticação por header "access_token" fixo). Conta real,
 * chave de PRODUÇÃO (decisão explícita do usuário em 2026-09-18) —
 * qualquer cobrança criada aqui é real, não é sandbox.
 */
const BASE_URL = process.env.ASAAS_ENV === "sandbox" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";

async function chamarApi<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurado.");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      "User-Agent": "portal-na",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`Asaas API ${path} -> HTTP ${res.status}: ${corpo}`);
  }
  return res.json() as Promise<T>;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
}

/**
 * Acha o cliente Asaas pelo CPF (evita duplicar) ou cria um novo — CPF
 * chega por parâmetro (digitado na hora do pagamento), nunca persistido
 * no nosso banco, mesma minimização já usada pra derivar senha inicial a
 * partir do CPF do Mercúrio.
 */
/**
 * `notificationDisabled: true` — confirmado ao vivo em 2026-09-21 que o
 * Asaas cobra uma "Taxa de mensageria" (R$0,99, separada da taxa do PIX)
 * toda vez que dispara uma notificação (e-mail/SMS) própria de cobrança
 * pro cliente. O Portal já avisa o membro por conta própria (WhatsApp,
 * status na tela) — pagar o Asaas pra mandar OUTRO aviso é custo sem uso.
 */
export async function asaasFindOrCreateCustomer(nome: string, cpf: string, email?: string): Promise<AsaasCustomer> {
  const cpfLimpo = cpf.replace(/\D/g, "");
  const existentes = await chamarApi<{ data: AsaasCustomer[] }>(`/customers?cpfCnpj=${cpfLimpo}`);
  if (existentes.data.length > 0) return existentes.data[0];

  return chamarApi<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({ name: nome, cpfCnpj: cpfLimpo, email, notificationDisabled: true }),
  });
}

export interface AsaasPayment {
  id: string;
  status: "PENDING" | "RECEIVED" | "CONFIRMED" | "OVERDUE" | "REFUNDED" | string;
  value: number;
  customer: string;
  /** Checkout hospedado pelo Asaas — usado pro fluxo de cartão de crédito (nenhum dado de cartão passa pelo nosso servidor). */
  invoiceUrl?: string;
}

export interface AsaasSplit {
  walletId: string;
  /** % (0-100) sobre o valor líquido — o que NÃO for enviado no split fica automaticamente na conta do BPO (a que criou a cobrança). */
  percentualValue?: number;
  fixedValue?: number;
}

export async function asaasCreatePixCharge(
  customerId: string,
  valor: number,
  descricao: string,
  vencimento: string,
  split?: AsaasSplit[],
): Promise<AsaasPayment> {
  return chamarApi<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value: valor,
      dueDate: vencimento, // "aaaa-mm-dd"
      description: descricao,
      ...(split && split.length > 0 ? { split } : {}),
    }),
  });
}

/**
 * Cartão de crédito — checkout hospedado pelo Asaas (`invoiceUrl`), nunca
 * dados de cartão direto no nosso servidor (evita todo o escopo de
 * conformidade PCI-DSS que a captura direta exigiria). `valor` aqui já deve
 * vir com a sobretaxa da taxa do cartão embutida (ver split.ts/
 * payment-actions.ts) — decisão do usuário 2026-09-22: repassar a taxa ao
 * aluno, não absorver pela escola/BPO.
 */
export async function asaasCreateCreditCardCharge(
  customerId: string,
  valor: number,
  descricao: string,
  vencimento: string,
  split?: AsaasSplit[],
): Promise<AsaasPayment> {
  return chamarApi<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: valor,
      dueDate: vencimento,
      description: descricao,
      ...(split && split.length > 0 ? { split } : {}),
    }),
  });
}

export interface AsaasPixQrCode {
  encodedImage: string; // base64 PNG
  payload: string; // texto "copia e cola"
  expirationDate: string;
}

export async function asaasGetPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return chamarApi<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

export async function asaasGetPaymentStatus(paymentId: string): Promise<AsaasPayment> {
  return chamarApi<AsaasPayment>(`/payments/${paymentId}`);
}

/** Cancela uma cobrança (ex: aluno desistiu, ou cobrança de teste) — best-effort, não lança se já não existir mais. */
export async function asaasCancelPayment(paymentId: string): Promise<void> {
  await chamarApi(`/payments/${paymentId}`, { method: "DELETE" }).catch(() => {});
}

export interface AsaasPixAutomaticAuthorization {
  id: string;
  status: "CREATED" | "ACTIVE" | "CANCELLED" | "REFUSED" | "EXPIRED";
  payload?: string; // "copia e cola" do QR code da 1ª cobrança/autorização
  encodedImage?: string; // base64 PNG do QR code
}

/**
 * Pix Automático (Asaas, lançado maio/2026) — débito recorrente de verdade,
 * diferente do PIX avulso: o cliente autoriza 1x (paga este QR code, que já
 * embute "pagamento da 1ª cobrança + autorização pros próximos ciclos") e
 * os ciclos seguintes são cobrados sem precisar de um novo QR code (ver
 * asaasCreatePixAutomaticCharge). `paymentCreationMode: MANUAL` (em vez de
 * SUBSCRIPTION) de propósito — decisão do usuário 2026-09-22: precisamos
 * controlar o VALOR de cada ciclo (composição do aluno varia mês a mês),
 * não um valor fixo automático do Asaas. `contractId` (até 35 caracteres) é
 * nosso identificador — usamos o memberId.
 */
export async function asaasCreatePixAutomaticAuthorization(
  customerId: string,
  contractId: string,
  valorPrimeiraCobranca: number,
  descricao: string,
): Promise<AsaasPixAutomaticAuthorization> {
  const hoje = new Date().toISOString().slice(0, 10);
  const descricaoCurta = descricao.slice(0, 35);
  return chamarApi<AsaasPixAutomaticAuthorization>("/pix/automatic/authorizations", {
    method: "POST",
    body: JSON.stringify({
      customerId,
      contractId: contractId.slice(0, 35),
      frequency: "MONTHLY",
      startDate: hoje,
      paymentCreationMode: "MANUAL",
      description: descricaoCurta,
      immediateQrCode: { originalValue: valorPrimeiraCobranca, expirationSeconds: 3600, description: descricaoCurta },
    }),
  });
}

export async function asaasGetPixAutomaticAuthorization(id: string): Promise<AsaasPixAutomaticAuthorization> {
  return chamarApi<AsaasPixAutomaticAuthorization>(`/pix/automatic/authorizations/${id}`);
}

/** Cancela a autorização — sem isso, o aluno não consegue "desligar" o débito automático (ver desativarPixAutomatico). */
export async function asaasCancelPixAutomaticAuthorization(id: string): Promise<void> {
  await chamarApi(`/pix/automatic/authorizations/${id}`, { method: "DELETE" });
}

/**
 * Cria a cobrança de 1 ciclo contra uma autorização já ATIVA — debitado
 * automaticamente, sem o aluno precisar fazer nada. Precisa ser criada
 * entre 2 e 10 dias úteis antes do vencimento (regra do Asaas) — ver o
 * worker em scripts/sync-monthly-status.ts que decide a janela certa.
 */
export async function asaasCreatePixAutomaticCharge(
  customerId: string,
  authorizationId: string,
  valor: number,
  descricao: string,
  vencimento: string,
  split?: AsaasSplit[],
): Promise<AsaasPayment> {
  return chamarApi<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value: valor,
      dueDate: vencimento,
      description: descricao,
      pixAutomaticAuthorizationId: authorizationId,
      ...(split && split.length > 0 ? { split } : {}),
    }),
  });
}

export interface AsaasPixFeeStatus {
  /** true = esse PIX provavelmente cai dentro da franquia gratuita do mês (não gera taxa). */
  isento: boolean;
  /** Taxa fixa vigente (com desconto promocional, se ainda ativo) caso NÃO isento. */
  taxaFixa: number;
}

/**
 * Confirmado ao vivo em 2026-09-21: o PIX no Asaas cobra uma taxa FIXA (não
 * percentual, `percentageFee: null`), e os primeiros `monthlyCreditsWithoutFee`
 * PIX recebidos no mês são gratuitos. Usado pra decidir, na hora de criar
 * uma cobrança, se o split deve reservar essa taxa pra escola (ver
 * asaas/split.ts) — best-effort: o contador reflete o estado NO MOMENTO da
 * criação da cobrança, não da confirmação do pagamento (que pode vir depois
 * e, em teoria, cruzar a franquia por causa de outras cobranças pagas antes).
 */
export async function asaasGetPixFeeStatus(): Promise<AsaasPixFeeStatus> {
  const dados = await chamarApi<{
    payment: {
      pix: {
        fixedFeeValue: number;
        fixedFeeValueWithDiscount: number | null;
        discountExpiration: string | null;
        monthlyCreditsWithoutFee: number;
        creditsReceivedOfCurrentMonth: number;
      };
    };
  }>("/myAccount/fees");
  const { pix } = dados.payment;
  const descontoVigente = pix.fixedFeeValueWithDiscount !== null && pix.discountExpiration !== null && new Date(pix.discountExpiration) > new Date();
  return {
    isento: pix.creditsReceivedOfCurrentMonth < pix.monthlyCreditsWithoutFee,
    taxaFixa: descontoVigente ? pix.fixedFeeValueWithDiscount! : pix.fixedFeeValue,
  };
}

export interface AsaasCreditCardFeeStatus {
  /** % sobre o valor (à vista, 1x — não oferecemos parcelamento por ora). */
  percentual: number;
  /** Taxa fixa por operação, somada ao percentual. */
  fixo: number;
}

/**
 * Confirmado ao vivo em 2026-09-22: taxa do cartão é bem mais alta que a do
 * PIX — percentual (2,99% à vista, com desconto promocional vigente até
 * 2026-12-18) + R$0,49 fixo por operação, além de levar 32 dias pra cair na
 * conta (vs. instantâneo no PIX). Só 1x (à vista) por ora — sem parcelamento.
 */
export async function asaasGetCreditCardFeeStatus(): Promise<AsaasCreditCardFeeStatus> {
  const dados = await chamarApi<{
    payment: {
      creditCard: {
        operationValue: number;
        oneInstallmentPercentage: number;
        discountOneInstallmentPercentage: number | null;
        hasValidDiscount: boolean;
      };
    };
  }>("/myAccount/fees");
  const { creditCard } = dados.payment;
  const percentual =
    creditCard.hasValidDiscount && creditCard.discountOneInstallmentPercentage !== null
      ? creditCard.discountOneInstallmentPercentage
      : creditCard.oneInstallmentPercentage;
  return { percentual, fixo: creditCard.operationValue };
}

export interface AsaasSubaccountInput {
  name: string;
  cpfCnpj: string;
  email: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string; // bairro
  postalCode: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
}

export interface AsaasSubaccount {
  id: string;
  walletId: string;
  accessToken?: { value: string }; // apiKey da subconta — só vem na criação, não é recuperável depois
}

/**
 * Cria uma subconta (1 por escola) — a conta-pai (BPO) precisa ser PJ.
 * Novas subcontas entram num período de avaliação regulatória (até 60
 * dias) com limite de R$2.000 em cobranças até serem aprovadas pelo
 * Asaas — vale pedir aprovação antecipada ao suporte assim que criar.
 */
export async function asaasCreateSubaccount(input: AsaasSubaccountInput): Promise<AsaasSubaccount> {
  return chamarApi<AsaasSubaccount>("/accounts", {
    method: "POST",
    body: JSON.stringify({ companyType: "ASSOCIATION", ...input }),
  });
}
