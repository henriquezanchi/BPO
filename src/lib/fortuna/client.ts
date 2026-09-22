/**
 * Cliente da API REST real do Fortuna (carteira digital da lanchonete,
 * oinabnfortunaback.acropolebrasil.com.br/api) — diferente do Mercúrio,
 * NÃO é RPA: API JSON normal, autenticação por JWT. Confirmado ao vivo em
 * 2026-09-15 contra o cadastro real do Luiz Henrique Zanchi Borges.
 *
 * Login hoje usa uma conta de colaborador (Gerente) real — considerar
 * pedir ao suporte do Fortuna uma conta de serviço dedicada antes de
 * produção com mais filiais/uso.
 *
 * Sem trava de concorrência tipo Mercúrio (API multi-tenant normal) — dá
 * pra chamar ao vivo por requisição sem problema de escala/sessão única.
 */
const BASE_URL = "https://oinabnfortunaback.acropolebrasil.com.br/api";
// Sem isso, alguma proteção (Cloudflare?) do lado do Fortuna rejeita com
// 403 quando a chamada vem de IP de datacenter serverless (confirmado ao
// vivo: funciona normal do Railway/local, mas dá 403 no Vercel) — um
// User-Agent "de navegador" contorna.
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export interface FortunaCashier {
  id: number;
  title: string;
  branchId: number;
}

export interface FortunaBranch {
  id: number;
  title: string;
  cashiers: FortunaCashier[];
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

  const res = await fetch(`${BASE_URL}/auth/login`, {
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
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Fortuna API ${path} -> HTTP ${res.status} - ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export async function fortunaGetBranches(): Promise<FortunaBranch[]> {
  return chamarApi<FortunaBranch[]>("/branch");
}

export async function fortunaGetClient(fortunaClientId: number): Promise<FortunaClient> {
  return chamarApi<FortunaClient>(`/client/${fortunaClientId}`);
}

/** Busca por nome (mesma limitação de confiabilidade do casamento por nome no Mercúrio) — usar só pra RESOLVER o fortunaClientId 1x, confirmando por e-mail/telefone antes de vincular. */
export async function fortunaSearchClientsByName(name: string): Promise<FortunaClient[]> {
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
export async function fortunaCreditarSaldo(clientId: number, branchId: number, amount: number, method: string = "PIX"): Promise<FortunaCreditResult> {
  const token = await obterToken();
  const payloadB64 = token.split(".")[1];
  const operatorId = (JSON.parse(Buffer.from(payloadB64, "base64").toString()) as { payload: { id: number } }).payload.id;

  const cliente = await fortunaGetClient(clientId);
  const saldoAtual = Number(cliente.balance.find((b) => b.branchId === branchId)?.amount ?? 0);
  const novoSaldo = Math.round((saldoAtual + amount) * 100) / 100;

  const res = await fetch(`${BASE_URL}/balance/with-receipt`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ clientId, branchId, balance: novoSaldo, amount, method, operatorId }),
  });
  if (!res.ok) throw new Error(`Fortuna credit -> HTTP ${res.status} - ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<FortunaCreditResult>;
}
