"use server";

import { requireDirector } from "@/lib/auth";
import { relatorioCampanha } from "@/lib/avaliacao";
import { db } from "@/lib/db";
import type { ResumoFilialDados } from "@/lib/mercurio-db/resumo-filial";

/**
 * Relatório da filial no Painel do Diretor (pedido do usuário 2026-10-19):
 * o resumo diário do Mercúrio (ResumoFilial, gerado na sincronização) +
 * números do próprio Portal calculados na hora.
 */
export async function getRelatorioFilial(schoolId: string) {
  await requireDirector(schoolId);
  const agora = new Date();
  const em30dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [resumo, comLogin, pedidosCadastro, pendencias, falhasMercurio, campanha, eventos] = await Promise.all([
    db.resumoFilial.findUnique({ where: { schoolId } }),
    db.member.count({ where: { schoolId, mercurioAtivo: true, authUserId: { not: null } } }),
    db.contactChangeLog.count({ where: { status: "pendente", member: { schoolId } } }),
    db.scholasticPendency.count({ where: { schoolId, completedAt: null } }),
    db.mercurioSyncTask.count({ where: { status: "falhou", member: { schoolId } } }),
    db.avaliacaoCampanha.findFirst({ where: { schoolId }, orderBy: { abertaEm: "desc" } }),
    db.event.findMany({
      where: { schoolId, startsAt: { gte: agora, lte: em30dias } },
      select: { id: true, title: true, startsAt: true, capacity: true, status: true, _count: { select: { registrations: true } } },
      orderBy: { startsAt: "asc" },
      take: 6,
    }),
  ]);

  let avaliacao: { titulo: string; status: string; participantes: number; mediaInstrutores: number | null; nps: number | null } | null = null;
  if (campanha) {
    const rel = await relatorioCampanha(campanha.id, {});
    const participantes = (await db.avaliacaoParticipacao.groupBy({ by: ["memberId"], where: { campanhaId: campanha.id } })).length;
    const notas = rel.porInstrutor.filter((i) => i.media !== null);
    const nps = rel.geral.perguntas.map((p) => (p.resumo.tipo === "escala" ? p.resumo.nps : null)).find((x) => x !== null) ?? null;
    avaliacao = {
      titulo: campanha.titulo,
      status: campanha.status,
      participantes,
      mediaInstrutores: notas.length ? notas.reduce((s, i) => s + i.media!, 0) / notas.length : null,
      nps,
    };
  }

  return {
    agora: agora.getTime(),
    resumo: resumo ? { geradoEm: resumo.geradoEm, dados: resumo.dados as unknown as ResumoFilialDados } : null,
    portal: { comLogin, pedidosCadastro, pendencias, falhasMercurio },
    avaliacao,
    eventos: eventos.map((e) => ({ id: e.id, titulo: e.title, inicio: e.startsAt, vagas: e.capacity, inscritos: e._count.registrations, status: e.status })),
  };
}

export type RelatorioFilial = Awaited<ReturnType<typeof getRelatorioFilial>>;
