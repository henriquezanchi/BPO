import { fetchAcropole } from "@/lib/ponte";
/**
 * Cliente da API REST real do Fortuna (carteira digital da lanchonete,
 * oinabnfortunaback.acropolebrasil.com.br/api) — diferente do Mercúrio,
 * NÃO é RPA: API JSON normal, autenticação por JWT. Confirmado ao vivo em
 * 2026-09-15 contra o cadastro real do Luiz Henrique Zanchi Borges.
 *
 * Desde 09/11/2026 o Portal usa a API de integração (chave própria, final do arquivo); o login com a conta de
 * colaborador (Gerente) abaixo ficou só como reserva.
 *
 * Sem trava de concorrência tipo Mercúrio (API multi-tenant normal) — dá
 * pra chamar ao vivo por requisição sem problema de escala/sessão única.
 */
const BASE_URL = "https://oinabnfortunaback.acropolebrasil.com.br/api";
// O Cloudflare da Nova Acrópole desafia a Vercel; as chamadas passam pela ponte da Cloudflare (lib/ponte.ts,
// fetchAcropole). O proxy antigo do Railway saiu do ar em 25/10/2026 e o código dele foi removido em 26/10/2026.
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export interface FortunaCashier {
  id: number;
  title: string;
  branchId: number;
}

export interface FortunaBranch {
  id: number;
  title: string;
  cashiers?: FortunaCashier[]; // só no login antigo; a API de integração não traz
}

export interface FortunaBalance {
  amount: string; // "3.35" — string decimal, não number (evita erro de float em dinheiro)
  clientId: number;
  branchId: number;
}

export interface FortunaClient {
  id: number;
  name: string;
  cellPhone: string;
  email: string;
  active: boolean;
  branch: { id: number; title: string }; // filial "de casa" do cliente, segundo o próprio Fortuna
  level: { id: number; title: string; acronym: string };
  balance: FortunaBalance[]; // 1 linha por filial onde já tem saldo
}

let tokenCache: { token: string; expiraEm: number } | null = null;

async function obterToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiraEm) return tokenCache.token;

  const inscricao = process.env.FORTUNA_INSCRICAO;
  const senha = process.env.FORTUNA_SENHA;
  if (!inscricao || !senha) throw new Error("FORTUNA_INSCRICAO/FORTUNA_SENHA não configurados.");

  const res = await fetchAcropole(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ id: inscricao, password: senha, accountType: "user" }),
  });
  if (!res.ok) throw new Error(`Falha ao logar no Fortuna: HTTP ${res.status} - ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { token: string };

  // O JWT do próprio Fortuna já tem "exp" (~1 dia, visto ao vivo) — cacheia
  // com uma margem de segurança de 5min pra não usar um token vencido.
  tokenCache = { token: data.token, expiraEm: Date.now() + 23 * 60 * 60 * 1000 };
  return data.token;
}

async function chamarApi<T>(path: string): Promise<T> {
  const token = await obterToken();
  const res = await fetchAcropole(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Fortuna API ${path} -> HTTP ${res.status} - ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

async function legadoGetBranches(): Promise<FortunaBranch[]> {
  return chamarApi<FortunaBranch[]>("/branch");
}

async function legadoGetClient(fortunaClientId: number): Promise<FortunaClient> {
  return chamarApi<FortunaClient>(`/client/${fortunaClientId}`);
}

/** Busca por nome (mesma limitação de confiabilidade do casamento por nome no Mercúrio) — usar só pra RESOLVER o fortunaClientId 1x, confirmando por e-mail/telefone antes de vincular. */
async function legadoSearchClientsByName(name: string): Promise<FortunaClient[]> {
  return chamarApi<FortunaClient[]>(`/clients/search?name=${encodeURIComponent(name)}`);
}

export interface FortunaCreditResult {
  balance: { amount: string; clientId: number; branchId: number };
  receipt: { id: number; amount: string; createdAt: string; method: string };
}

/**
 * Credita saldo real na carteira Fortuna de um cliente — endpoint de
 * escrita confirmado ao vivo em 2026-09-21 (capturado do DevTools durante um
 * lançamento manual real feito por um colaborador "Gerente" no painel
 * deles): PUT /balance/with-receipt. Ao contrário do resto da API (só
 * leitura), esse endpoint espera o SALDO TOTAL NOVO (não só o delta) — por
 * isso lê o saldo atual da filial antes de calcular. `operatorId` é
 * decodificado do próprio token (é o id da conta configurada em
 * FORTUNA_INSCRICAO/FORTUNA_SENHA) — o Fortuna registra quem lançou.
 */
async function legadoCreditarSaldo(clientId: number, branchId: number, amount: number, method: string = "PIX"): Promise<FortunaCreditResult> {

  const token = await obterToken();
  const payloadB64 = token.split(".")[1];
  const operatorId = (JSON.parse(Buffer.from(payloadB64, "base64").toString()) as { payload: { id: number } }).payload.id;

  const cliente = await fortunaGetClient(clientId);
  const saldoAtual = Number(cliente.balance.find((b) => b.branchId === branchId)?.amount ?? 0);
  const novoSaldo = Math.round((saldoAtual + amount) * 100) / 100;

  const res = await fetchAcropole(`${BASE_URL}/balance/with-receipt`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ clientId, branchId, balance: novoSaldo, amount, method, operatorId }),
  });
  if (!res.ok) throw new Error(`Fortuna credit -> HTTP ${res.status} - ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<FortunaCreditResult>;
}


// ===================== API de integração (09/11/2026) =====================
// Chave própria da integração (FORTUNA_API_KEY, sem login de colaborador), base FORTUNA_API_URL (domínio, com ou sem
// /api/integration/v1), pelo mesmo caminho da ponte da Cloudflare. Leituras caem no login antigo se a integração
// falhar. Crédito só usa o login antigo quando a integração NÃO está configurada: filial não autorizada pelo Fortuna
// não é contornada, e crédito com resultado incerto nunca é repetido por outro caminho.

export class FortunaErro extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const integracaoConfigurada = () => !!process.env.FORTUNA_API_KEY;
const baseIntegracao = () =>
  `${(process.env.FORTUNA_API_URL || "https://oinabnfortunaback.acropolebrasil.com.br").replace(/\/+$/, "").replace(/\/api\/integration\/v1$/, "")}/api/integration/v1`;

async function integracao<T>(path: string, init: RequestInit = {}, tentativa = 0): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${process.env.FORTUNA_API_KEY}`);
  headers.set("Accept", "application/json");
  const res = await fetchAcropole(`${baseIntegracao()}${path}`, { ...init, headers, signal: AbortSignal.timeout(20_000) });
  if (res.status === 429 && tentativa < 2) {
    await new Promise((ok) => setTimeout(ok, Math.min(Number(res.headers.get("retry-after") ?? 2) || 2, 10) * 1000));
    return integracao<T>(path, init, tentativa + 1);
  }
  if (!res.ok) {
    const corpo = await res.text();
    let msg = corpo;
    try {
      msg = (JSON.parse(corpo) as { message?: string }).message ?? corpo;
    } catch {
      /* corpo não é JSON */
    }
    throw new FortunaErro(`Fortuna (integração) ${path.split("?")[0]} -> HTTP ${res.status} - ${String(msg).slice(0, 200)}`, res.status);
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
}

/** Leitura: integração primeiro; se falhar (ou não estiver configurada), o login antigo. */
async function lerComReserva<T>(nova: () => Promise<T>, antiga: () => Promise<T>): Promise<T> {
  if (!integracaoConfigurada()) return antiga();
  try {
    return await nova();
  } catch (e) {
    if (e instanceof FortunaErro && e.status === 404) throw e; // cliente não existe (ou inativo): o outro caminho não ajuda
    console.error("Fortuna: integração falhou, usando o login antigo:", (e as Error).message);
    return antiga();
  }
}

export async function fortunaGetBranches(): Promise<FortunaBranch[]> {
  return lerComReserva(() => integracao<FortunaBranch[]>("/branch"), legadoGetBranches);
}

export async function fortunaGetClient(fortunaClientId: number): Promise<FortunaClient> {
  return lerComReserva(() => integracao<FortunaClient>(`/client/${fortunaClientId}`), () => legadoGetClient(fortunaClientId));
}

/** Busca por nome (pode trazer várias pessoas: nunca escolher sozinho). Uma página de até 100. */
export async function fortunaSearchClientsByName(name: string): Promise<FortunaClient[]> {
  return lerComReserva(
    async () => (await integracao<Pagina<FortunaClient>>(`/clients/search?name=${encodeURIComponent(name)}&pageSize=100`)).data,
    () => legadoSearchClientsByName(name),
  );
}

/**
 * Credita `amount` (o valor a somar, não o saldo final) na filial. `chave` identifica o pagamento: repetir a mesma chave
 * nunca credita de novo (Idempotency-Key do Fortuna), então "tentar de novo" é seguro.
 */
export async function fortunaCreditarSaldo(clientId: number, branchId: number, amount: number, chave: string, method: string = "PIX"): Promise<FortunaCreditResult> {
  if (!integracaoConfigurada()) return legadoCreditarSaldo(clientId, branchId, amount, method);
  if (!/^[\x21-\x7e]{1,128}$/.test(chave)) throw new Error("Chave de idempotência inválida para o Fortuna.");
  const enviar = () =>
    integracao<FortunaCreditResult>(`/client/${clientId}/credit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": chave },
      body: JSON.stringify({ branchId, amount: amount.toFixed(2), method }),
    });
  // Sem nova tentativa automática: a ponte da Cloudflare só repassa o Idempotency-Key depois de publicada a versão de
  // 09/11/2026. Erro fica registrado e a "nova tentativa" do painel do Café usa a mesma chave.
  return enviar();
}

export type Pagina<T> = { data: T[]; page: number; pageSize: number; hasMore: boolean };
export type FortunaRecebimento = { id: number; amount: string; method: string; createdAt: string; branchId: number; operator: { id: number; name: string } | null };
export type FortunaVenda = {
  id: number;
  value: string;
  discount: string;
  saleDate: string;
  isCanceled: boolean;
  dependent: string | null;
  cashier: { id: number; title: string; branchId: number } | null;
  products: { productId: number; amount: number; value: string; product: { title: string } }[];
};

/** Recebimentos (créditos e estornos) no período AAAA-MM-DD, fuso de Brasília. Só pela integração. */
export async function fortunaExtrato(clientId: number, inicio: string, fim: string, pagina = 1) {
  return integracao<Pagina<FortunaRecebimento>>(`/client/${clientId}/extrato?start=${inicio}&end=${fim}&page=${pagina}&pageSize=50`);
}

/** Consumo (vendas não canceladas) no período AAAA-MM-DD. Só pela integração. */
export async function fortunaConsumo(clientId: number, inicio: string, fim: string, pagina = 1) {
  return integracao<Pagina<FortunaVenda>>(`/client/${clientId}/consumo?start=${inicio}&end=${fim}&page=${pagina}&pageSize=50`);
}
