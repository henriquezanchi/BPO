import { db } from "@/lib/db";
import { consultarMercurio, sqlTexto } from "@/lib/mercurio-db/client";
import type { ChavePix } from "@/lib/asaas/saque";
import { faixaDoSpread, fixoDoMes } from "@/lib/spread-comum";

/**
 * Spread do BPO e configuração da cobrança on-line por escola (12/11/2026). Regras em lib/spread-comum.ts e em
 * docs/CRONOGRAMA-SPREAD-ASAAS-2026-11.md (seção 0). Tudo fica em ResumoNacional (JSON), sem tabela nova:
 * - "cobranca:config": escopo (siglas do Mercúrio que entram na contagem) e escolas que NÃO repassam a taxa do cartão;
 * - "spread:AAAA-MM": a faixa congelada do mês, contada na primeira cobrança do mês (= ativos no fim do mês anterior).
 */
const CHAVE_CONFIG = "cobranca:config";

/** Projeto piloto (12/11/2026): Goiás (sem Valparaíso), Barra do Garças e Sede Nacional (Brasília). */
export const ESCOPO_PILOTO = ["BSB", "BGA", "GYN", "JAM", "STO", "GAR", "RVD", "APS", "GY2", "ALT", "ELD", "PER", "CAT", "ITU"];

type Config = { escopo?: string[]; cartaoSemRepasse?: string[]; chavesPix?: Record<string, ChavePix> };

export async function configCobranca(): Promise<Required<Config>> {
  const linha = await db.resumoNacional.findUnique({ where: { chave: CHAVE_CONFIG } });
  const c = (linha?.dados ?? {}) as Config;
  return {
    escopo: Array.isArray(c.escopo) && c.escopo.length ? c.escopo : ESCOPO_PILOTO,
    cartaoSemRepasse: Array.isArray(c.cartaoSemRepasse) ? c.cartaoSemRepasse : [],
    chavesPix: c.chavesPix && typeof c.chavesPix === "object" ? c.chavesPix : {},
  };
}

async function gravarConfig(c: Required<Config>) {
  await db.resumoNacional.upsert({ where: { chave: CHAVE_CONFIG }, update: { dados: c, geradoEm: new Date() }, create: { chave: CHAVE_CONFIG, dados: c } });
}

/** Padrão: a taxa do cartão é repassada ao aluno (decisão de 22/09/2026), salvo se a escola escolheu absorver. */
export async function cartaoRepassaTaxa(schoolId: string): Promise<boolean> {
  return !(await configCobranca()).cartaoSemRepasse.includes(schoolId);
}

export async function definirRepasseCartao(schoolId: string, repassa: boolean) {
  const c = await configCobranca();
  const sem = new Set(c.cartaoSemRepasse);
  if (repassa) sem.delete(schoolId);
  else sem.add(schoolId);
  await gravarConfig({ ...c, cartaoSemRepasse: [...sem] });
}

/** Chave Pix da escola para saque (asaas/saque.ts). */
export async function chavePixDaEscola(schoolId: string): Promise<ChavePix | null> {
  return (await configCobranca()).chavesPix[schoolId] ?? null;
}

export async function gravarChavePix(schoolId: string, chave: ChavePix | null) {
  const c = await configCobranca();
  const chavesPix = { ...c.chavesPix };
  if (chave) chavesPix[schoolId] = chave;
  else delete chavesPix[schoolId];
  await gravarConfig({ ...c, chavesPix });
}

export type ContagemEscopo = { total: number; porUnidade: Record<string, number>; fonte: "mercurio" | "portal"; contadoEm: string };

/** Ativos das escolas do escopo. Conta no Mercúrio (cadastro é consulta ao vivo); se falhar, no banco do Portal. */
export async function contarEscopo(escopo: string[]): Promise<ContagemEscopo> {
  const porUnidade: Record<string, number> = Object.fromEntries(escopo.map((u) => [u, 0]));
  let fonte: ContagemEscopo["fonte"] = "mercurio";
  try {
    const linhas = await consultarMercurio(
      `SELECT cad_unidade, COUNT(*) n FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade IN (${escopo.map(sqlTexto).join(",")}) GROUP BY cad_unidade`,
    );
    for (const l of linhas) porUnidade[String(l.cad_unidade)] = Number(l.n) || 0;
  } catch {
    fonte = "portal";
    const escolas = await db.school.findMany({ where: { mercurioUnidade: { in: escopo } }, select: { id: true, mercurioUnidade: true } });
    for (const e of escolas) porUnidade[e.mercurioUnidade!] = await db.member.count({ where: { schoolId: e.id, mercurioAtivo: true } });
  }
  return { total: Object.values(porUnidade).reduce((s, n) => s + n, 0), porUnidade, fonte, contadoEm: new Date().toISOString() };
}

export type SpreadDoMes = ContagemEscopo & { mes: string; percentual: number };

const mesAtual = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

/**
 * Taxa do mês corrente. Congelada na primeira consulta do mês (a contagem desse momento = ativos no fim do mês anterior,
 * como manda a regra "faixa atingida → taxa no mês seguinte"); daí em diante, toda cobrança do mês usa a mesma taxa.
 */
export async function spreadDoMes(): Promise<SpreadDoMes> {
  const mes = mesAtual();
  const chave = `spread:${mes}`;
  const salvo = await db.resumoNacional.findUnique({ where: { chave } });
  if (salvo) return salvo.dados as SpreadDoMes;
  const contagem = await contarEscopo((await configCobranca()).escopo);
  const dados: SpreadDoMes = { ...contagem, mes, percentual: faixaDoSpread(contagem.total).percentual };
  // Corrida entre duas cobranças simultâneas: a primeira gravação vale.
  await db.resumoNacional.upsert({ where: { chave }, update: {}, create: { chave, dados } });
  return ((await db.resumoNacional.findUnique({ where: { chave } }))?.dados as SpreadDoMes) ?? dados;
}

export type LinhaDemonstrativo = { unidade: string; escola: string; pagamentos: number; volume: number; spread: number };

/**
 * Demonstrativo do mês (dono do sistema): contribuições pagas pelo Portal nas escolas do escopo, spread de cada escola
 * e quanto a Secretaria Nacional de Economia completa até o fixo. O spread é estimado pela taxa da faixa do mês (as
 * cobranças antigas, de antes de 12/11/2026, saíram com 2%). Ainda não inclui inscrições em eventos nem matrículas.
 */
export async function demonstrativoDoMes(ano: number, mes: number) {
  const chave = `spread:${ano}-${String(mes).padStart(2, "0")}`;
  const congelado = (await db.resumoNacional.findUnique({ where: { chave } }))?.dados as { percentual?: number } | undefined;
  const config = await configCobranca();
  const percentual = congelado?.percentual ?? faixaDoSpread((await contarEscopo(config.escopo)).total).percentual;
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 3));
  const fim = new Date(Date.UTC(ano, mes, 1, 3));
  const escolas = await db.school.findMany({ where: { mercurioUnidade: { in: config.escopo } }, select: { id: true, name: true, mercurioUnidade: true } });
  const pagas = await db.paymentCharge.findMany({
    where: { status: "pago", paidAt: { gte: inicio, lt: fim }, member: { schoolId: { in: escolas.map((e) => e.id) } } },
    select: { amount: true, fortunaTopUpAmount: true, member: { select: { schoolId: true } } },
  });
  const linhas: LinhaDemonstrativo[] = escolas.map((e) => {
    const daEscola = pagas.filter((p) => p.member.schoolId === e.id);
    const volume = daEscola.reduce((s, p) => s + Number(p.amount) + Number(p.fortunaTopUpAmount ?? 0), 0);
    return { unidade: e.mercurioUnidade!, escola: e.name.replace(/^Nova Acr[oó]pole\s*-\s*/i, ""), pagamentos: daEscola.length, volume, spread: Math.round(volume * percentual) / 100 };
  });
  const spread = Math.round(linhas.reduce((s, l) => s + l.spread, 0) * 100) / 100;
  return { percentual, linhas: linhas.filter((l) => l.pagamentos).sort((a, b) => b.volume - a.volume), spread, sne: fixoDoMes(spread), estimado: !congelado };
}
