import "server-only";
import { escolasChefiadas, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { fusoDaEscola } from "@/lib/atendimentos";
import { db } from "@/lib/db";
import { hojeNoFuso } from "@/lib/diario";
import { estaAberta } from "@/lib/oportunidades-comum";
import { publicosDaPessoa } from "@/lib/event-policy";
import { filiaisAdministradas } from "@/lib/recursos-filial";
import type { Member } from "@prisma/client";

/**
 * Oportunidades de voluntariado (pedido do usuário 2026-10-29). Quem cadastra: a Direção da filial (chefes,
 * sub-chefe e administradores) e os responsáveis de secretarias e grupos de voluntários. Quem vê: os membros
 * (2º nível em diante) e quem a Direção já liberou como voluntário. O responsável de cada oportunidade recebe
 * os interessados e aceita ou recusa; ao aceitar, a pessoa entra no grupo vinculado, se houver.
 * Toda ação reconfere a permissão no servidor (actions/oportunidades-actions.ts).
 */
export const TIPOS_GRUPO_VINCULO = ["SEC", "GDVE"] as const;
const TIPOS_RESPONSAVEL = ["SEC", "GDVE", "BF", "BM", "CS"];

export type Gestor = Pick<
  Member,
  "id" | "schoolId" | "isDiretor" | "isSubChefe" | "filiaisChefiadas" | "mercurioId" | "isSecretarioEscolastica" | "isSecretarioEconomia"
>;

/** Filiais em que a pessoa gere todas as oportunidades e se ela, como responsável, pode cadastrar na própria. */
export async function gestaoDeOportunidades(m: Gestor) {
  const [chefiadas, administradas] = await Promise.all([escolasChefiadas(m), filiaisAdministradas(m)]);
  const escolas = [...new Set([...chefiadas, ...administradas, ...(m.isSubChefe ? [m.schoolId] : [])])];
  const [liderados, mandatos, acesso] = await Promise.all([
    db.classMembership.count({ where: { memberId: m.id, role: "professor", classGroup: { tipo: { in: TIPOS_RESPONSAVEL }, arquivadoEm: null } } }),
    db.secretariaMandato.count({ where: { memberId: m.id, ativo: true } }),
    temAcessoVoluntario(m),
  ]);
  const responsavel = acesso && (liderados > 0 || mandatos > 0 || m.isSecretarioEscolastica || m.isSecretarioEconomia);
  return { escolas, responsavel, podeCadastrar: escolas.length > 0 || responsavel };
}

export type GestaoOportunidades = Awaited<ReturnType<typeof gestaoDeOportunidades>>;

/** Direção da filial gere todas; o responsável, as que criou ou de que é responsável. */
export function podeGerir(m: { id: string }, g: GestaoOportunidades, op: { schoolId: string; responsavelId: string; criadoPorId: string }) {
  return g.escolas.includes(op.schoolId) || op.responsavelId === m.id || op.criadoPorId === m.id;
}

/** Grupos que a pessoa pode vincular: secretarias e GDVE da filial (Direção) ou os que ela coordena. */
export async function gruposVinculaveis(m: { id: string }, g: GestaoOportunidades, schoolId: string) {
  return db.classGroup.findMany({
    where: {
      schoolId,
      tipo: { in: [...TIPOS_GRUPO_VINCULO] },
      arquivadoEm: null,
      ...(g.escolas.includes(schoolId) ? {} : { memberships: { some: { memberId: m.id, role: "professor" } } }),
    },
    select: { id: true, name: true, tipo: true },
    orderBy: { name: "asc" },
  });
}

/** Quem pode ser responsável: a própria pessoa e, para a Direção, quem tem acesso de voluntário na filial. */
export async function responsaveisPossiveis(m: { id: string; name: string }, g: GestaoOportunidades, schoolId: string) {
  if (!g.escolas.includes(schoolId)) return [{ id: m.id, name: m.name }];
  const liberados = (await db.acessoVoluntario.findMany({ select: { memberId: true } })).map((a) => a.memberId);
  return db.member.findMany({
    where: {
      schoolId,
      mercurioAtivo: true,
      OR: [{ id: m.id }, { id: { in: liberados } }, { isDiretor: true }, { isSubChefe: true }, { isSecretarioEscolastica: true }, { isSecretarioEconomia: true }],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export const hojeDaFilial = (uf: string | null | undefined) => hojeNoFuso(fusoDaEscola(uf));

export { estaAberta };

/** Filtro do banco equivalente a estaAberta. */
export const filtroAbertas = (hoje: string) => ({
  encerradaEm: null,
  AND: [{ OR: [{ abertaAte: null }, { abertaAte: { gte: hoje } }] }, { OR: [{ tipo: { not: "pontual" } }, { data: null }, { data: { gte: hoje } }] }],
});

type MembroComEscola = Parameters<typeof publicosDaPessoa>[0] & Gestor & { school: { uf: string | null } };

/** Só membros, ou quem a Direção já liberou como voluntário. */
export async function podeVerOportunidades(m: MembroComEscola) {
  return publicosDaPessoa(m).includes("membros") || (await temAcessoVoluntario(m));
}

/** Para o quadro do membro: oportunidades abertas da filial e as que a pessoa já respondeu nos últimos 60 dias. */
export async function oportunidadesParaMembro(m: MembroComEscola) {
  if (!(await podeVerOportunidades(m))) return [];
  const hoje = hojeDaFilial(m.school.uf);
  const lista = await db.oportunidadeVoluntariado.findMany({
    where: {
      schoolId: m.schoolId,
      OR: [filtroAbertas(hoje), { interesses: { some: { memberId: m.id, status: { not: "desistiu" }, createdAt: { gte: new Date(Date.now() - 60 * 864e5) } } } }],
    },
    include: { responsavel: { select: { name: true } }, interesses: { select: { memberId: true, status: true } } },
    orderBy: [{ data: "asc" }, { createdAt: "desc" }],
    take: 30,
  });
  return lista.map((op) => {
    const meu = op.interesses.find((i) => i.memberId === m.id);
    const aceitos = op.interesses.filter((i) => i.status === "aceito").length;
    return {
      id: op.id,
      titulo: op.titulo,
      area: op.area,
      descricao: op.descricao,
      tipo: op.tipo,
      data: op.data,
      horario: op.horario,
      vagas: op.vagas,
      aceitos,
      lotada: op.vagas != null && aceitos >= op.vagas,
      aberta: estaAberta(op, hoje),
      responsavel: op.responsavel.name.split(" ")[0],
      meuStatus: meu?.status ?? null,
    };
  });
}

export type OportunidadeDoMembro = Awaited<ReturnType<typeof oportunidadesParaMembro>>[number];


/** Para o destaque da página inicial: quantas estão abertas e a mais próxima, ainda sem resposta da pessoa. */
export async function destaqueDeOportunidades(m: { id: string; schoolId: string; school: { uf: string | null } }) {
  const where = { schoolId: m.schoolId, ...filtroAbertas(hojeDaFilial(m.school.uf)) };
  const [total, proxima] = await Promise.all([
    db.oportunidadeVoluntariado.count({ where }),
    db.oportunidadeVoluntariado.findFirst({
      where: { ...where, interesses: { none: { memberId: m.id } } },
      select: { titulo: true, area: true, tipo: true, data: true, horario: true },
      orderBy: [{ data: "asc" }, { createdAt: "desc" }],
    }),
  ]);
  return total ? { total, proxima } : null;
}

/** Ofertas por área (quadro Voluntariado, lista fixa) dos últimos 6 meses — antes só apareciam na ficha de cada pessoa. */
export function ofertasPorArea(schoolId: string) {
  return db.volunteerOffer.findMany({
    where: { member: { schoolId, mercurioAtivo: true }, createdAt: { gte: new Date(Date.now() - 180 * 864e5) } },
    include: { member: { select: { name: true, whatsapp: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}
