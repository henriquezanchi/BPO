import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sincronizarUnidade } from "@/lib/mercurio-db/importar";

/**
 * Sincronização diária do Mercúrio (pedido do usuário 2026-10-26: "faça tudo"; antes só rodava à mão, e a rotina do
 * Railway estava fora do ar). A rotina /api/cron/mercurio chama `avancarSincronizacao` de hora em hora: pega a filial
 * do Portal sincronizada há mais tempo (mais de 20 h), processa os membros em lotes até o orçamento de tempo, guarda
 * onde parou (ResumoNacional "rotina-estado:mercurio") e, ao terminar a filial, roda o fechamento (quem saiu, matérias,
 * grupos, catálogo). Goiânia Universitário (~290 membros) leva umas 3 rodadas; as 8 filiais cabem no dia.
 */
const CHAVE = "rotina-estado:mercurio";
const LOTE = 20;
const INTERVALO_FILIAL_MS = 20 * 60 * 60 * 1000;

type Estado = { uni: string | null; pendentes: string[]; inicio: string | null; ultimas: Record<string, string> };

async function lerEstado(): Promise<Estado> {
  const r = await db.resumoNacional.findUnique({ where: { chave: CHAVE } });
  const d = (r?.dados ?? {}) as Partial<Estado>;
  return { uni: d.uni ?? null, pendentes: d.pendentes ?? [], inicio: d.inicio ?? null, ultimas: d.ultimas ?? {} };
}

async function gravarEstado(e: Estado) {
  const dados = e as unknown as Prisma.InputJsonValue;
  await db.resumoNacional.upsert({ where: { chave: CHAVE }, update: { dados, geradoEm: new Date() }, create: { chave: CHAVE, dados } });
}

export async function avancarSincronizacao(orcamentoMs = 200_000) {
  const t0 = Date.now();
  let estado = await lerEstado();
  const feito: string[] = [];
  while (Date.now() - t0 < orcamentoMs) {
    if (!estado.uni) {
      const escolas = await db.school.findMany({
        where: { mercurioUnidade: { not: null }, sistemaRegistro: { not: "mercury" }, members: { some: { mercurioAtivo: true } } },
        select: { id: true, mercurioUnidade: true },
      });
      const vez = escolas
        .filter((e) => Date.now() - Date.parse(estado.ultimas[e.mercurioUnidade!] ?? "1970-01-01") > INTERVALO_FILIAL_MS)
        .sort((a, b) => (estado.ultimas[a.mercurioUnidade!] ?? "").localeCompare(estado.ultimas[b.mercurioUnidade!] ?? ""))[0];
      if (!vez) break;
      const membros = await db.member.findMany({ where: { schoolId: vez.id, mercurioAtivo: true, mercurioId: { not: null } }, select: { mercurioId: true }, orderBy: { mercurioId: "asc" } });
      estado = { ...estado, uni: vez.mercurioUnidade!, pendentes: membros.map((m) => m.mercurioId!), inicio: new Date().toISOString() };
      await gravarEstado(estado);
    }
    const uni = estado.uni!;
    if (estado.pendentes.length) {
      const lote = estado.pendentes.slice(0, LOTE);
      await sincronizarUnidade(uni, { matriculas: lote });
      estado = { ...estado, pendentes: estado.pendentes.slice(LOTE) };
      feito.push(`${uni}: ${lote.length} membro(s)`);
    } else {
      await sincronizarUnidade(uni, { apenasFechamento: true });
      estado = { uni: null, pendentes: [], inicio: null, ultimas: { ...estado.ultimas, [uni]: new Date().toISOString() } };
      feito.push(`${uni}: fechamento`);
    }
    await gravarEstado(estado);
  }
  return { feito, emAndamento: estado.uni ? { unidade: estado.uni, faltam: estado.pendentes.length } : null, ultimas: estado.ultimas };
}
