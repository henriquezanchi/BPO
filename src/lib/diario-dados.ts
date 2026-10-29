import { fusoDaEscola } from "@/lib/atendimentos";
import { db } from "@/lib/db";
import { datasPermitidas, fogoInterno, hojeNoFuso, praticaNoDia } from "@/lib/diario";

/**
 * Leitura do diário (servidor). Sempre da própria pessoa: ninguém mais lê o diário de outro (decisão do responsável,
 * ver docs/CONTINUIDADE-VOLUNTARIADO-DIARIOS.md).
 */
export const hojeDaPessoa = (m: { school: { uf: string | null } | null }) => hojeNoFuso(fusoDaEscola(m.school?.uf));

export async function carregarDiario(m: { id: string; school: { uf: string | null } | null }, dataPedida?: string) {
  const hoje = hojeDaPessoa(m);
  const permitidas = datasPermitidas(hoje);
  const data = dataPedida && permitidas.includes(dataPedida) ? dataPedida : hoje;
  const [dia, praticas, comEpilogo, recentes, total] = await Promise.all([
    db.diarioDia.findUnique({ where: { memberId_data: { memberId: m.id, data } } }),
    db.diarioPratica.findMany({ where: { memberId: m.id, arquivadaEm: null }, orderBy: { createdAt: "asc" } }),
    db.diarioDia.findMany({ where: { memberId: m.id, epilogoEm: { not: null } }, select: { data: true } }),
    db.diarioDia.findMany({ where: { memberId: m.id, data: { in: permitidas } }, select: { data: true, prologoEm: true, epilogoEm: true } }),
    db.diarioDia.count({ where: { memberId: m.id, OR: [{ prologoEm: { not: null } }, { epilogoEm: { not: null } }] } }),
  ]);
  const feitas = (dia?.praticas ?? {}) as Record<string, boolean>;
  return {
    hoje,
    data,
    datas: permitidas.map((d) => {
      const r = recentes.find((x) => x.data === d);
      return { data: d, prologo: !!r?.prologoEm, epilogo: !!r?.epilogoEm };
    }),
    dia: dia && {
      virtude: dia.virtude,
      compromisso: dia.compromisso,
      prologoFeito: !!dia.prologoEm,
      semPrologo: dia.semPrologo,
      falhei: dia.falhei,
      fizBem: dia.fizBem,
      deixeiDeFazer: dia.deixeiDeFazer,
      reflexaoLivre: dia.reflexaoLivre,
      epilogoFeito: !!dia.epilogoEm,
    },
    praticas: praticas.map((p) => ({ id: p.id, nome: p.nome, recorrencia: p.recorrencia, diasSemana: p.diasSemana, diaMes: p.diaMes, doDia: praticaNoDia(p, data), feita: !!feitas[p.id] })),
    fogo: { ...fogoInterno(comEpilogo.map((d) => d.data), hoje), total },
  };
}

export type DiarioDaPessoa = Awaited<ReturnType<typeof carregarDiario>>;
