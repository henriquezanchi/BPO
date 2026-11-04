import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { compararEspelho } from "./comparar";
import { lerLadoAntigo } from "./ler-antigo";
import { lerLadoNovo } from "./ler-novo";
import type { Acao } from "./tipos";

/**
 * Rodada do espelho (rotina noturna, /api/cron/espelho-mercury): para cada escola ligada, lê o novo e o antigo,
 * compara e guarda as diferenças em EspelhoMercuryItem. Não grava nada no Mercúrio antigo: isso é aplicar.ts, que só
 * pega itens aprovados.
 *
 * EM ESPERA desde 04/11/2026: só roda com ESPELHO_MERCURY_LIGADO=1, a migração 20261104200000_espelho_mercury
 * aplicada e uma linha em EspelhoMercuryConfig. Passos para ligar: docs/PLANO-ESPELHO-MERCURY-MERCURIO.md.
 */
export const espelhoLigado = () => process.env.ESPELHO_MERCURY_LIGADO === "1";

/** Estados que a rodada ainda mexe. Feito (robô ou à mão) e ignorado não voltam, mesmo que a diferença continue. */
const ABERTOS = ["pendente", "aprovado", "erro", "resolvido"];

export async function rodarEspelho() {
  if (!espelhoLigado()) return [];
  const configs = await db.espelhoMercuryConfig.findMany({ where: { modo: { not: "desligado" } }, include: { school: true } });
  const resultados = [];
  const inicio = Date.now();
  for (const cfg of configs) {
    try {
      const { school } = cfg;
      if (!school.mercuryBranchId || !school.mercurioUnidade) throw new Error("Escola sem mercuryBranchId ou mercurioUnidade.");
      // Rotina tem 300 s; deixa ~60 s para o banco do antigo e a gravação.
      const novo = await lerLadoNovo(school.mercuryBranchId, cfg.desde, { prazo: inicio + 230_000 });
      const antigo = await lerLadoAntigo(school.mercurioUnidade, cfg.desde, novo.pessoas.map((p) => p.matricula));
      const acoes = compararEspelho(novo, antigo, { desde: cfg.desde, filial: school.name });
      const r = await gravarAcoes(school.id, cfg.modo, acoes);
      await db.espelhoMercuryConfig.update({ where: { schoolId: school.id }, data: { rodada: new Date(), erro: null } });
      resultados.push({ schoolId: school.id, ...r });
    } catch (e) {
      const erro = (e as Error).message.slice(0, 500);
      await db.espelhoMercuryConfig.update({ where: { schoolId: cfg.schoolId }, data: { rodada: new Date(), erro } });
      resultados.push({ schoolId: cfg.schoolId, erro });
    }
  }
  return resultados;
}

export async function gravarAcoes(schoolId: string, modo: string, acoes: Acao[], agora = new Date()) {
  const existentes = await db.espelhoMercuryItem.findMany({ where: { schoolId }, select: { id: true, chave: true, status: true } });
  const porChave = new Map(existentes.map((e) => [e.chave, e]));
  let novas = 0;
  for (const a of acoes) {
    const campos = {
      tipo: a.tipo,
      area: a.area,
      matricula: a.matricula,
      nome: a.nome,
      resumo: a.resumo,
      dados: a.dados as Prisma.InputJsonValue,
      robo: (a.robo ?? undefined) as Prisma.InputJsonValue | undefined,
      revisao: a.revisao,
      vistoEm: agora,
    };
    const e = porChave.get(a.chave);
    if (!e) {
      const sozinho = modo === "automatico" && a.robo !== null && !a.revisao;
      await db.espelhoMercuryItem.create({
        data: { schoolId, chave: a.chave, ...campos, status: sozinho ? "aprovado" : "pendente", decididoPor: sozinho ? "automatico" : null, decididoEm: sozinho ? agora : null },
      });
      novas++;
    } else if (ABERTOS.includes(e.status)) {
      await db.espelhoMercuryItem.update({ where: { id: e.id }, data: { ...campos, status: e.status === "resolvido" ? "pendente" : e.status } });
    }
  }
  // Diferença que sumiu sem ninguém marcar: alguém lançou direto no antigo, ou o novo mudou de novo. Aprovado que
  // sumiu também sai da fila, para o robô não repetir o que já foi feito à mão.
  const vistas = new Set(acoes.map((a) => a.chave));
  const sumiram = existentes.filter((e) => !vistas.has(e.chave) && ["pendente", "aprovado", "erro"].includes(e.status)).map((e) => e.id);
  if (sumiram.length) await db.espelhoMercuryItem.updateMany({ where: { id: { in: sumiram } }, data: { status: "resolvido", feitoEm: agora } });
  return { diferencas: acoes.length, novas, resolvidas: sumiram.length };
}
