/**
 * Cliente da API externa de LEITURA do Mercúrio ("Mercury v1", ver PDF
 * "api-externa-consumidor (mercurio).pdf", recebido do administrador do
 * Mercúrio em 2026-10-15) — diferente do resto da integração com o
 * Mercúrio (sempre RPA/Playwright, ver src/lib/mercurio/), esta é uma API
 * JSON normal, bearer token fixo (chave "mrc_...", emitida manualmente por
 * um administrador, sem fluxo de login). SOMENTE LEITURA — não cria,
 * altera nem apaga nada lá. Toda escrita continua via RPA
 * (src/lib/mercurio/browser-session.ts).
 *
 * Tipos confirmados ao vivo em 2026-10-15 contra a matrícula real 21596
 * (Luiz Henrique Zanchi Borges, filial BARRA DO GARÇAS, branchId "52") —
 * não são só o que o PDF descreve em prosa, são o JSON de verdade.
 *
 * Achado importante: a chave emitida enxerga filiais de QUALQUER país
 * (viu também filiais dos EUA nos testes) — "filiais" concedidas aqui
 * aparenta ser "todas", não só Brasil. Sempre filtrar por branchId
 * conhecido (ver School.mercuryBranchId) pra nunca misturar dado de outra
 * organização sem querer.
 *
 * `coverage` em várias respostas é a própria API avisando que aquele
 * sub-campo específico não está populado/catalogado no Mercúrio pra essa
 * filial (ex: visto ao vivo "subChief": "not_in_cargo_catalog" — não dá
 * pra inferir Sub-Chefe a partir do cargo ainda). Nunca tratar um campo
 * coberto por `coverage` como ausência real de dado — é "não modelado",
 * diferente de "modelado e vazio".
 */
const BASE_URL = "https://sincere-passion-production-416b.up.railway.app/external/v1";

export interface MercuryPage<T> {
  data: T[];
  page: { limit: number; nextCursor: string | null };
}

interface MercuryErrorBody {
  statusCode?: number;
  message?: string;
  error?: string;
}

function obterChave(): string {
  const chave = process.env.MERCURY_API_KEY;
  if (!chave) throw new Error("MERCURY_API_KEY não configurada.");
  if (!chave.startsWith("mrc_")) throw new Error("MERCURY_API_KEY não parece uma chave válida (deveria começar com 'mrc_').");
  return chave;
}

/**
 * GET genérico contra a Mercury API. Até 5 retries em 429 (120 req/min por
 * chave, ver PDF seção 10), com backoff exponencial (1s, 2s, 4s, 8s, 16s) —
 * achado ao vivo 2026-10-15: 1 retry só de 1s não é suficiente ao
 * paginar/varrer listas grandes (estourou o limite várias vezes seguidas
 * numa varredura global). Não monta fila/throttle preventivo aqui enquanto
 * o volume de chamadas for baixo (scripts de sync periódicos, não tráfego
 * ao vivo do Portal).
 */
/** Exportado pra scripts de descoberta ad-hoc (ex: varrer /people com pacing próprio); uso normal é pelas funções mercuryGet* abaixo. */
export async function mercuryGet<T>(path: string, tentativa = 0): Promise<T> {
  const chave = obterChave();
  const correlationId = crypto.randomUUID();

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${chave}`,
      Accept: "application/json",
      "X-Correlation-Id": correlationId,
    },
  });

  if (res.status === 429 && tentativa < 5) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** tentativa));
    return mercuryGet<T>(path, tentativa + 1);
  }

  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as MercuryErrorBody | null;
    throw new Error(`Mercury API ${path} -> HTTP ${res.status}${corpo?.message ? ` - ${corpo.message}` : ""} (correlationId: ${correlationId})`);
  }

  return res.json() as Promise<T>;
}

function montarQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined) query.set(chave, String(valor));
  }
  const texto = query.toString();
  return texto ? `?${texto}` : "";
}

/**
 * Pagina uma rota de listagem até o fim (page.nextCursor null), devolvendo
 * tudo já concatenado — uso em sync periódico, não em requisição ao vivo do
 * Portal (ver aviso no PDF: "não monte o cursor à mão", por isso sempre via
 * esta função, nunca manualmente).
 */
async function mercuryGetTudo<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T[]> {
  const itens: T[] = [];
  let cursor: string | undefined;
  do {
    const pagina = await mercuryGet<MercuryPage<T>>(`${path}${montarQuery({ ...params, cursor })}`);
    itens.push(...pagina.data);
    cursor = pagina.page.nextCursor ?? undefined;
  } while (cursor);
  return itens;
}

// ---------------------------------------------------------------------
// Tipos — confirmados ao vivo em 2026-10-15
// ---------------------------------------------------------------------

export interface MercuryBranchRef {
  id: string;
  name: string;
}

export interface MercuryLevel {
  code: string; // ex: "N2", "N3", "CA" (Círculo de Amigos), "PP" (Pré-Provacionista)
  name: string;
}

export interface MercuryClassRef {
  id: string;
  name: string;
  weekDay: number; // 0 domingo .. 6 sábado
  startTime: string; // "HH:mm"
  schedules: unknown[]; // nunca visto populado ainda
}

export interface MercuryPerson {
  registrationNo: string;
  fullName: string;
  active: boolean;
  admissionDate: string | null; // "YYYY-MM-DD"
  reentry: unknown | null;
  level: MercuryLevel | null;
  class: MercuryClassRef | null;
  branch: MercuryBranchRef | null;
  updatedAt: string; // ISO datetime
  coverage?: Record<string, string>;
}

export interface MercuryPersonDossier {
  registrationNo: string;
  fullName: string;
  active: boolean;
  phones: { primary: string | null; alternate: string | null };
  email: string | null;
  city: string | null;
  state: string | null;
  profession: string | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  maritalStatus: string | null;
  educationLevel: string | null;
  educations: unknown[];
  employments: unknown[];
  documents: { type: string; number: string }[]; // visto ao vivo: type "CPF" (sem zero à esquerda, ver client.ts) e "RG"
  admissionDate: string | null;
  memberSince: string | null;
  enrollmentChannel: string | null;
  deactivation: { at: string | null; reason: string | null };
  reentry: unknown | null;
  integrationCourses: unknown | null;
  coverage?: Record<string, string>;
}

export type MercuryStandingStatus = "PAGANTE" | "BOLSISTA" | "ISENTO";
export type MercuryMonthStatus = "pago" | "em_branco" | "atrasado" | "isento" | "cancelado";

export interface MercuryContributionMonth {
  month: number; // 1-12
  status: MercuryMonthStatus;
  amount: string | null; // "300.00"
  paidOn: string | null; // "YYYY-MM-DD"
  planId: string | null;
}

export interface MercuryContributions {
  registrationNo: string;
  year: number;
  standing: MercuryStandingStatus;
  months: MercuryContributionMonth[];
}

export interface MercuryContributionPlan {
  registrationNo: string;
  standing: MercuryStandingStatus;
  plan: {
    id: string;
    name: string;
    finalAmount: string;
    components: { label: string; kind: string; value: string; order: number }[];
  } | null;
  adjustments: unknown[];
  coverage?: Record<string, string>;
}

/** Confirmado ao vivo 2026-10-16 (matrícula 21596). `items` veio sempre vazio até agora. */
export interface MercuryReceipt {
  id: string;
  number: string;
  date: string; // "YYYY-MM-DD"
  amount: string; // "120.00"
  description: string | null;
  interestedParty: string | null;
  receiptActive: boolean | null; // null = não informado; false = cancelado
  studentActive: boolean | null;
  signedAt: string | null;
  items: unknown[];
}

export interface MercuryStaffMember {
  registrationNo: string | null;
  fullName: string;
  role: string; // visto "COLABORADOR DE FILIAL", "Não informado" — cargo bruto do Mercúrio, não normalizado
  cargoCode?: string; // "???" quando o cargo não está no catálogo (ver coverage)
  scope?: string; // "LOCAL"
  startDate?: string;
}

export interface MercuryBranchStaff {
  branch: MercuryBranchRef;
  director: { registrationNo: string | null; fullName: string; role: string } | null;
  roles: MercuryStaffMember[];
  coverage?: Record<string, string>;
}

/**
 * Formato do item AINDA NÃO confirmado contra um retorno real — as 2
 * chamadas feitas até agora (filial dos EUA e Barra do Garças) vieram com
 * `rows: []`. Nomes de campo abaixo são inferidos só da prosa do PDF
 * ("Totais confirmados por rubrica e mês"), não de JSON de verdade — tratar
 * como provisório até ver 1 linha real.
 */
export interface MercuryMovementRow {
  rubrica: string;
  type: "INCOME" | "EXPENSE";
  entradas: number;
  saidas: number;
}

export interface MercuryBranchMovements {
  branchId: string;
  year: number;
  month: number;
  status: "CONFIRMED" | string;
  rows: MercuryMovementRow[];
}

export interface MercuryClassPersonRef {
  registrationNo: string;
  fullName: string;
  level?: string;
}

export interface MercuryClass {
  id: string;
  name: string;
  status: "EM_ANDAMENTO" | "CONCLUIDO" | "INATIVO";
  level: MercuryLevel | null;
  branch: MercuryBranchRef;
  weekDay: number;
  startTime: string;
  schedules: unknown[];
  instructors: MercuryClassPersonRef[];
  students: MercuryClassPersonRef[];
}

export interface MercuryInstructor {
  registrationNo: string;
  fullName: string;
  branch: MercuryBranchRef;
  pedagogue: boolean; // NÃO é "é instrutor" — subconjunto bem menor (6 de 48 em Universitário); Member.isPedagogo = estar nesta lista
  classOpening: boolean;
  livingForces: boolean; // "Forças Vivas" (FV)
}

export interface MercuryCatalogCategory {
  code: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  branchId: string | null; // null = categoria nacional, vale pra toda filial
  active: boolean;
}

/** Ainda não testado ao vivo — formato a confirmar na 1ª chamada real. */
export type MercuryCashBox = unknown;

// ---------------------------------------------------------------------
// /people — escopo people.read (+ people.pii pro /dossier)
// ---------------------------------------------------------------------

export async function mercuryGetPeople(params: {
  branchId?: string;
  active?: boolean;
  updatedSince?: string;
  limit?: number;
} = {}): Promise<MercuryPerson[]> {
  return mercuryGetTudo<MercuryPerson>("/people", params);
}

export async function mercuryGetPerson(matricula: string): Promise<MercuryPerson> {
  return mercuryGet<MercuryPerson>(`/people/${encodeURIComponent(matricula)}`);
}

export async function mercuryGetContributions(matricula: string, year?: number): Promise<MercuryContributions> {
  return mercuryGet<MercuryContributions>(`/people/${encodeURIComponent(matricula)}/contributions${montarQuery({ year })}`);
}

export async function mercuryGetContributionPlan(matricula: string): Promise<MercuryContributionPlan> {
  return mercuryGet<MercuryContributionPlan>(`/people/${encodeURIComponent(matricula)}/contribution-plan`);
}

export async function mercuryGetReceipts(matricula: string): Promise<MercuryReceipt[]> {
  return mercuryGetTudo<MercuryReceipt>(`/people/${encodeURIComponent(matricula)}/receipts`);
}

/** Exige people.read E people.pii na chave — sem o 2º escopo, contato/nascimento/documentos não vêm. */
export async function mercuryGetDossier(matricula: string): Promise<MercuryPersonDossier> {
  return mercuryGet<MercuryPersonDossier>(`/people/${encodeURIComponent(matricula)}/dossier`);
}

// ---------------------------------------------------------------------
// /branches — escopo staff.read / economy.read
// ---------------------------------------------------------------------

export async function mercuryGetBranchStaff(branchId: string): Promise<MercuryBranchStaff> {
  return mercuryGet<MercuryBranchStaff>(`/branches/${encodeURIComponent(branchId)}/staff`);
}

export async function mercuryGetBranchMovements(branchId: string, year: number, month: number): Promise<MercuryBranchMovements> {
  return mercuryGet<MercuryBranchMovements>(`/branches/${encodeURIComponent(branchId)}/movements${montarQuery({ year, month })}`);
}

// ---------------------------------------------------------------------
// /classes, /instructors — escopo people.read
// ---------------------------------------------------------------------

export async function mercuryGetClasses(params: {
  branchId?: string;
  level?: string; // códigos separados por vírgula, ex: "CA,CO,TA,JN"
  status?: "EM_ANDAMENTO" | "CONCLUIDO" | "INATIVO";
  limit?: number;
} = {}): Promise<MercuryClass[]> {
  return mercuryGetTudo<MercuryClass>("/classes", params);
}

export async function mercuryGetInstructors(params: { branchId?: string; pedagogue?: boolean } = {}): Promise<MercuryInstructor[]> {
  return mercuryGetTudo<MercuryInstructor>("/instructors", params);
}

// ---------------------------------------------------------------------
// /catalog — escopo catalog.read
// ---------------------------------------------------------------------

export async function mercuryGetCatalogCategories(): Promise<MercuryCatalogCategory[]> {
  return mercuryGetTudo<MercuryCatalogCategory>("/catalog/categories");
}

export async function mercuryGetCashBoxes(): Promise<MercuryCashBox[]> {
  return mercuryGetTudo<MercuryCashBox>("/catalog/cash-boxes");
}
