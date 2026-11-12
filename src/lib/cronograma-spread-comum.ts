/** Tipos e rótulos do cronograma do spread, sem acesso ao banco (usados também na tela). Ver lib/cronograma-spread.ts. */
export const SITUACOES = { afazer: "A fazer", andamento: "Em andamento", bloqueado: "Bloqueado", feito: "Feito" } as const;
export type Situacao = keyof typeof SITUACOES;

export type Registro = { em: string; texto: string };
export type AcaoCronograma = {
  id: string;
  fase: string;
  inicio: string; // AAAA-MM-DD
  fim: string;
  status: Situacao;
  acao: string;
  pessoas: string; // separadas por vírgula
  materiais: string; // uma por linha
  duracao: string; // tempo médio, em texto
  dias: number | null; // tempo médio em dias úteis (alerta de prazo curto)
  obs: string;
  registros: Registro[];
};

/** Feriados nacionais no período do cronograma (não contam como dia útil). */
export const FERIADOS = new Set(["2026-11-20", "2026-12-25", "2027-01-01", "2027-02-15", "2027-02-16", "2027-04-02", "2027-04-21", "2027-05-01"]);

const data = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Dias úteis de `a` até `b`, os dois inclusive. */
export function diasUteis(a: string, b: string): number {
  if (!a || !b || b < a) return 0;
  let n = 0;
  for (const d = data(a); d <= data(b); d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6 && !FERIADOS.has(d.toISOString().slice(0, 10))) n++;
  }
  return n;
}

export type Alerta = { tipo: "ok" | "atrasada" | "bloqueada" | "curto" | "comece" | "normal"; titulo: string; detalhe: string };

/** Alerta de tempo de cada ação, comparando o tempo médio com o prazo (hoje = AAAA-MM-DD em Brasília). */
export function alertaDe(a: AcaoCronograma, hoje: string): Alerta {
  const media = a.duracao || (a.dias ? `${a.dias} dias úteis` : "sem estimativa");
  const uteis = diasUteis(a.inicio, a.fim);
  const dias = a.dias ?? 0;
  const plural = (n: number) => `${n} dia${n === 1 ? "" : "s"} út${n === 1 ? "il" : "eis"}`;
  if (a.status === "feito") return { tipo: "ok", titulo: "Concluída", detalhe: `Leva em média ${media}.` };
  if (a.fim < hoje) return { tipo: "atrasada", titulo: "Atrasada", detalhe: `O prazo era ${a.fim.split("-").reverse().join("/")}. Leva em média ${media}.` };
  if (a.status === "bloqueado") return { tipo: "bloqueada", titulo: "Bloqueada", detalhe: `Leva em média ${media} depois de destravar.` };
  if (dias && uteis < dias) return { tipo: "curto", titulo: "Prazo curto", detalhe: `Leva em média ${media}; o prazo dá ${plural(uteis)}.` };
  const restam = diasUteis(hoje, a.fim);
  if (a.status === "afazer" && dias && a.inicio <= hoje && restam < dias) return { tipo: "comece", titulo: "Comece hoje", detalhe: `Leva em média ${media}; restam ${plural(restam)}.` };
  return { tipo: "normal", titulo: `≈ ${media}`, detalhe: uteis ? `O prazo dá ${plural(uteis)}.` : "" };
}
