/**
 * Programas Merlin e Janos — regras puras (sem banco), testadas em tests/infantojuvenil.test.ts.
 * Pedido do usuário 09/11/2026: marcar quem é voluntário de cada programa, de forma discreta e pesquisável, e
 * controlar a certidão negativa criminal (exigência do ECA, renovada a cada 6 meses).
 */
export const PROGRAMAS = ["MERLIN", "JANOS"] as const;
export type Programa = (typeof PROGRAMAS)[number];
export const NOME_PROGRAMA: Record<Programa, string> = { MERLIN: "Merlin", JANOS: "Janos" };
export const ehPrograma = (x: unknown): x is Programa => typeof x === "string" && (PROGRAMAS as readonly string[]).includes(x);

export const MESES_VALIDADE = 6;
export const DIAS_AVISO = 30;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** Programas citados num texto (função do Mercúrio, nome de secretaria). "Infantojuvenis" vale pelos dois. */
export function programasNoTexto(texto: string): Programa[] {
  const t = norm(texto);
  if (/INFANTO ?JUVENI/.test(t)) return [...PROGRAMAS];
  const r: Programa[] = [];
  if (/\bMERLI[NM]\b/.test(t)) r.push("MERLIN");
  if (/\bJANOS\b/.test(t)) r.push("JANOS");
  return r;
}

/**
 * Funções do Mercúrio que dirigem o programa: secretário(a), pró-secretário(a), sub-secretário(a) ou coordenador(a).
 * Colaborador e monitor não dirigem. Função com "NACIONAL" vale para todas as filiais.
 */
export function direcaoPorFuncao(cargos: string[]): { programa: Programa; nacional: boolean }[] {
  const r: { programa: Programa; nacional: boolean }[] = [];
  for (const c of cargos) {
    const t = norm(c);
    if (!/^(PRO ?SECRETARI[OA]|SUB ?SECRETARI[OA]|SECRETARI[OA]|COORDENADOR[A]?|DIRETOR[A]?)\b/.test(t)) continue;
    for (const programa of programasNoTexto(t)) r.push({ programa, nacional: /\bNACIONAL\b/.test(t) });
  }
  return r;
}

/** Acesso de quem dirige: "todas" as filiais ou por filial, e os programas em cada caso. */
export type AcessoInfantojuvenil = { todas: Programa[]; porEscola: Record<string, Programa[]> };

export function acessoVazio(a: AcessoInfantojuvenil) {
  return a.todas.length === 0 && Object.values(a.porEscola).every((p) => p.length === 0);
}

export function programasNaEscola(a: AcessoInfantojuvenil, schoolId: string): Programa[] {
  return PROGRAMAS.filter((p) => a.todas.includes(p) || (a.porEscola[schoolId] ?? []).includes(p));
}

/** Validade: 6 meses depois da data da certidão (no mesmo dia do mês; fim de mês se o dia não existir). */
export function validadeDaCertidao(em: Date): Date {
  const y = em.getUTCFullYear(), m = em.getUTCMonth() + MESES_VALIDADE, d = em.getUTCDate();
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, ultimo)));
}

export type Situacao = "sem" | "vencida" | "vencendo" | "emDia";
export const ROTULO_SITUACAO: Record<Situacao, string> = { sem: "Sem certidão", vencida: "Vencida", vencendo: "Vence em breve", emDia: "Em dia" };

/** Situação na data de hoje (comparação por dia, em UTC — as datas são guardadas sem hora). */
export function situacaoDaCertidao(validade: Date | null, hoje: Date): Situacao {
  if (!validade) return "sem";
  const dia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const faltam = Math.round((dia(validade) - dia(hoje)) / 86_400_000);
  if (faltam < 0) return "vencida";
  if (faltam <= DIAS_AVISO) return "vencendo";
  return "emDia";
}

/** Data de formulário (AAAA-MM-DD) → Date em UTC; rejeita data futura e anterior a 2 anos. */
export function lerDataCertidao(valor: string, hoje: Date): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) return null;
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  if (d.getTime() > hojeUtc + 86_400_000) return null;
  if (d.getTime() < hojeUtc - 2 * 366 * 86_400_000) return null;
  return d;
}
