import { timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notificarErroSuporte } from "@/lib/error-notify";

/**
 * Rotinas agendadas (vercel.json) — pedido do usuário 2026-10-26: falha de rotina não pode passar despercebida.
 * `executarRotina` roda cada tarefa isolada (uma falha não impede as outras), avisa o suporte pelo WhatsApp
 * (notificarErroSuporte, com dedupe) e grava a última execução em ResumoNacional com a chave "rotina:<nome>",
 * lida pela página de saúde (/admin/saude).
 */
export const ROTINAS = {
  ulisses: { titulo: "Eventos do Ulisses", intervaloMin: 24 * 60 },
  notificacoes: { titulo: "Avisos no celular (push)", intervaloMin: 5 },
  financeiro: { titulo: "Conferência de pagamentos e Pix Automático", intervaloMin: 10 },
  "event-refunds": { titulo: "Reembolsos de eventos", intervaloMin: 5 },
  aberturas: { titulo: "Aberturas de turma", intervaloMin: 24 * 60 },
  resumos: { titulo: "Resumos do Mercúrio (Visão geral)", intervaloMin: 15 },
  mercurio: { titulo: "Importação do Mercúrio (membros)", intervaloMin: 30 },
  "fila-mercurio": { titulo: "Lançamentos no Mercúrio (fila de escrita)", intervaloMin: 10 },
  saude: { titulo: "Verificação de saúde (ponte, Ulisses, Fortuna, Mercúrio)", intervaloMin: 60 },
} as const;
export type NomeRotina = keyof typeof ROTINAS;

export function autorizadoCron(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export type ExecucaoRotina = { ok: boolean; inicio: string; duracaoMs: number; tarefas: Record<string, unknown>; falhas: string[] };

/** Roda as tarefas em sequência, cada uma isolada; registra e devolve o resultado. */
export async function executarRotina(nome: NomeRotina, tarefas: Record<string, () => Promise<unknown>>): Promise<ExecucaoRotina> {
  const inicio = new Date();
  const resultado: Record<string, unknown> = {};
  const falhas: string[] = [];
  for (const [tarefa, fn] of Object.entries(tarefas)) {
    try {
      resultado[tarefa] = await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      resultado[tarefa] = { erro: msg };
      falhas.push(`${tarefa}: ${msg}`);
      console.error(`Rotina ${nome} (${tarefa}) falhou:`, e);
      await notificarErroSuporte({ message: `Rotina "${ROTINAS[nome].titulo}" — ${tarefa}: ${msg.slice(0, 200)}`, path: `/api/cron/${nome}`, routeType: "cron" });
    }
  }
  const execucao: ExecucaoRotina = { ok: !falhas.length, inicio: inicio.toISOString(), duracaoMs: Date.now() - inicio.getTime(), tarefas: resultado, falhas };
  await registrarExecucao(nome, execucao);
  console.log(JSON.stringify({ rotina: nome, ...execucao }));
  return execucao;
}

async function registrarExecucao(nome: NomeRotina, execucao: ExecucaoRotina) {
  const chave = `rotina:${nome}`;
  try {
    const anterior = await db.resumoNacional.findUnique({ where: { chave }, select: { dados: true } });
    const antes = (anterior?.dados ?? {}) as { ultimaFalha?: string; ultimoSucesso?: string };
    const dados = {
      ...execucao,
      // Resultado detalhado pode ser grande; guarda só o necessário para a página de saúde.
      tarefas: Object.fromEntries(Object.entries(execucao.tarefas).map(([k, v]) => [k, JSON.stringify(v ?? null).slice(0, 300)])),
      ultimoSucesso: execucao.ok ? execucao.inicio : antes.ultimoSucesso ?? null,
      ultimaFalha: execucao.ok ? antes.ultimaFalha ?? null : execucao.inicio,
    } as Prisma.InputJsonValue;
    await db.resumoNacional.upsert({ where: { chave }, update: { dados, geradoEm: new Date() }, create: { chave, dados } });
  } catch (e) {
    console.error(`Rotina ${nome}: não foi possível registrar a execução:`, e);
  }
}

export type SituacaoRotina = {
  nome: NomeRotina;
  titulo: string;
  intervaloMin: number;
  ultimaExecucao: string | null;
  ok: boolean | null;
  atrasada: boolean;
  falhas: string[];
  ultimoSucesso: string | null;
  ultimaFalha: string | null;
  duracaoMs: number | null;
};

/** Situação de todas as rotinas: atrasada = sem rodar há mais de 2 intervalos (mínimo 30 min de folga). */
export async function situacaoDasRotinas(): Promise<SituacaoRotina[]> {
  const linhas = await db.resumoNacional.findMany({ where: { chave: { startsWith: "rotina:" } } });
  return (Object.keys(ROTINAS) as NomeRotina[]).map((nome) => {
    const r = linhas.find((l) => l.chave === `rotina:${nome}`);
    const d = (r?.dados ?? null) as (ExecucaoRotina & { ultimoSucesso?: string | null; ultimaFalha?: string | null }) | null;
    const folgaMs = Math.max(2 * ROTINAS[nome].intervaloMin, 30) * 60_000;
    return {
      nome,
      titulo: ROTINAS[nome].titulo,
      intervaloMin: ROTINAS[nome].intervaloMin,
      ultimaExecucao: r ? r.geradoEm.toISOString() : null,
      ok: d ? d.ok : null,
      atrasada: !r || Date.now() - r.geradoEm.getTime() > folgaMs,
      falhas: d?.falhas ?? [],
      ultimoSucesso: d?.ultimoSucesso ?? null,
      ultimaFalha: d?.ultimaFalha ?? null,
      duracaoMs: d?.duracaoMs ?? null,
    };
  });
}
