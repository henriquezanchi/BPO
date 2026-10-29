import type { Destino } from "@/lib/area-trabalho";
import { db } from "@/lib/db";
import { termoVigente } from "@/lib/volunteer-term";

/**
 * Boas-vindas de quem acabou de ter a área de voluntários liberada (pedido do usuário 2026-10-29): no próximo acesso
 * ao Portal, um agradecimento, as áreas em que a pessoa foi indicada, o que ela pode fazer no Portal do Voluntário e o
 * termo para ler e assinar. Só para quem foi liberado (AcessoVoluntario) — Chefe de Filial tem acesso pelo cargo.
 * Aparece enquanto o termo não está assinado ou nos 60 dias depois da liberação; o "já vi" fica no aparelho.
 */
const JANELA_MS = 60 * 864e5;
const TIPOS_DE_AREA = ["SEC", "BF", "BM", "CS", "GDVE"];

type Pessoa = {
  id: string;
  schoolId: string;
  isSecretarioEscolastica: boolean;
  isSecretarioEconomia: boolean;
  classMemberships: { classGroup: { name: string; tipo: string; arquivadoEm: Date | null } }[];
};

export async function boasVindasDoVoluntario(m: Pessoa, destinos: Destino[]) {
  const acesso = await db.acessoVoluntario.findUnique({ where: { memberId: m.id } });
  if (!acesso) return null;
  const [termo, liberador, mandatos] = await Promise.all([
    termoVigente(m.id, m.schoolId),
    db.member.findUnique({ where: { id: acesso.liberadoPorId }, select: { name: true } }),
    db.secretariaMandato.findMany({ where: { memberId: m.id, ativo: true }, select: { secretaria: true } }),
  ]);
  if (termo && Date.now() - acesso.liberadoEm.getTime() > JANELA_MS) return null;
  const areas = [
    ...new Set([
      ...m.classMemberships.filter((c) => !c.classGroup.arquivadoEm && TIPOS_DE_AREA.includes(c.classGroup.tipo)).map((c) => c.classGroup.name),
      ...(m.isSecretarioEscolastica ? ["Secretaria de Escolástica"] : []),
      ...(m.isSecretarioEconomia ? ["Secretaria de Economia"] : []),
      ...mandatos.map((x) => x.secretaria),
    ]),
  ];
  return {
    chave: acesso.liberadoEm.toISOString(),
    liberadoPor: liberador?.name.split(" ")[0] ?? null,
    areas,
    oQueFazer: destinos.filter((d) => d.href !== "/voluntario" && d.href !== "/voluntario/termo").map((d) => ({ rotulo: d.rotulo, descricao: d.descricao })),
    termoAssinado: !!termo,
  };
}

export type BoasVindasVoluntario = NonNullable<Awaited<ReturnType<typeof boasVindasDoVoluntario>>>;
