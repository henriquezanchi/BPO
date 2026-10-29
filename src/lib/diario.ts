import { FRASES_DO_DIARIO } from "@/lib/diario-conteudo";
import { FRASES_PADRAO } from "@/lib/telas-frases";

/**
 * Diário filosófico dentro do Portal (pedido do usuário 2026-10-29), versão simplificada do Diário Filosófico:
 * Prólogo (virtude e compromisso), Epílogo (três perguntas ou reflexão livre), práticas da pessoa e o Fogo Interno.
 * Regras sem banco (rodam também no navegador); leitura e gravação em diario-dados.ts e actions/diario-actions.ts.
 * Privado: só a própria pessoa lê.
 */

/** Até quantos dias antes de hoje dá para preencher (pedido do usuário: no máximo 3). */
export const DIAS_ANTERIORES = 3;

/** Graus do Fogo Interno, como no diário antigo: dias seguidos com o Epílogo feito. */
export const GRAUS = [
  { min: 0, titulo: "Cinzas Frias", descricao: "O fogo aguarda para ser aceso." },
  { min: 1, titulo: "Centelha", descricao: "A primeira faísca do seu compromisso." },
  { min: 3, titulo: "Chama Desperta", descricao: "O fogo da vontade começa a crescer." },
  { min: 7, titulo: "Tocha Iluminadora", descricao: "A luz que guia seus passos." },
  { min: 21, titulo: "Fogueira", descricao: "O calor da disciplina se estabeleceu." },
  { min: 30, titulo: "Forja Filosófica", descricao: "O caráter é moldado pelo hábito." },
  { min: 90, titulo: "Farol de Sabedoria", descricao: "Sua constância ilumina a si e aos outros." },
  { min: 180, titulo: "Sol Interior", descricao: "Luz própria e autodomínio." },
  { min: 365, titulo: "Fogo Prometeico", descricao: "A chama divina da sabedoria inabalável." },
] as const;

export type Recorrencia = "diaria" | "semanal" | "quinzenal" | "mensal";
export const RECORRENCIAS: Record<Recorrencia, string> = { diaria: "Todos os dias", semanal: "Em dias da semana", quinzenal: "A cada 14 dias", mensal: "Uma vez por mês" };
export const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const UM_DIA = 864e5;
const emDias = (data: string) => Math.round(Date.parse(`${data}T12:00:00Z`) / UM_DIA);
export const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T12:00:00Z`) + n * UM_DIA).toISOString().slice(0, 10);

/** Hoje ("AAAA-MM-DD") no fuso da escola. */
export function hojeNoFuso(fuso = "America/Sao_Paulo", agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Datas que podem ser preenchidas: hoje e os 3 dias anteriores, do mais recente ao mais antigo. */
export function datasPermitidas(hoje: string) {
  return Array.from({ length: DIAS_ANTERIORES + 1 }, (_, i) => somarDias(hoje, -i));
}

/** Fogo Interno: sequência atual (terminando hoje ou ontem), recorde e grau. */
export function fogoInterno(datasComEpilogo: string[], hoje: string) {
  const dias = [...new Set(datasComEpilogo.map(emDias))].sort((a, b) => a - b);
  let recorde = 0;
  let corrida = 0;
  for (let i = 0; i < dias.length; i++) {
    corrida = i > 0 && dias[i] === dias[i - 1] + 1 ? corrida + 1 : 1;
    recorde = Math.max(recorde, corrida);
  }
  const h = emDias(hoje);
  const conjunto = new Set(dias);
  let atual = 0;
  for (let d = conjunto.has(h) ? h : h - 1; conjunto.has(d); d--) atual++;
  const grau = [...GRAUS].reverse().find((g) => atual >= g.min) ?? GRAUS[0];
  const proximo = GRAUS.find((g) => g.min > atual) ?? null;
  return { atual, recorde, grau, proximo, faltam: proximo ? proximo.min - atual : 0 };
}

/** A prática cai neste dia? Diária; dias da semana (0 = domingo); a cada 14 dias desde a data-base; dia do mês. */
export function praticaNoDia(p: { recorrencia: string; diasSemana: number[]; diaMes: number | null; dataBase: string }, data: string) {
  const dia = new Date(`${data}T12:00:00Z`);
  switch (p.recorrencia) {
    case "semanal":
      return p.diasSemana.includes(dia.getUTCDay());
    case "quinzenal": {
      const dif = emDias(data) - emDias(p.dataBase);
      return dif >= 0 && dif % 14 === 0;
    }
    case "mensal":
      return dia.getUTCDate() === (p.diaMes ?? new Date(`${p.dataBase}T12:00:00Z`).getUTCDate());
    default:
      return true;
  }
}

/** Frases do dia: as do Portal (com obra) e as do diário antigo. */
export const FRASES_DO_DIA: { texto: string; autor: string; obra: string | null }[] = [...FRASES_PADRAO, ...FRASES_DO_DIARIO.map((f) => ({ ...f, obra: null }))];

/** Uma frase fixa por dia (a mesma para todos), na ordem da lista, sem repetir até dar a volta. */
export function fraseDoDia(data: string) {
  const n = FRASES_DO_DIA.length;
  return FRASES_DO_DIA[((emDias(data) % n) + n) % n];
}

/** Epílogo válido: as três respostas, ou a reflexão livre (regra do diário antigo). */
export function epilogoValido(e: { falhei?: string | null; fizBem?: string | null; deixeiDeFazer?: string | null; reflexaoLivre?: string | null }) {
  const t = (v?: string | null) => !!v?.trim();
  return (t(e.falhei) && t(e.fizBem) && t(e.deixeiDeFazer)) || t(e.reflexaoLivre);
}
