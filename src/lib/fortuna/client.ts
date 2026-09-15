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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: inscricao, password: senha, accountType: "user" }),
  });
  if (!res.ok) throw new Error(`Falha ao logar no Fortuna: HTTP ${res.status}`);
  const data = (await res.json()) as { token: string };

  // O JWT do próprio Fortuna já tem "exp" (~1 dia, visto ao vivo) — cacheia
  // com uma margem de segurança de 5min pra não usar um token vencido.
  tokenCache = { token: data.token, expiraEm: Date.now() + 23 * 60 * 60 * 1000 };
  return data.token;
}

async function chamarApi<T>(path: string): Promise<T> {
  const token = await obterToken();
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Fortuna API ${path} -> HTTP ${res.status}`);
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
