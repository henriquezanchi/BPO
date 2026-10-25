import { db } from "@/lib/db";
import { ehTipoGrupo, gruposDaAgenda, papelNoGrupo, TIPOS_DO_PORTAL, TIPOS_GRUPO, type Papel, type TipoGrupo } from "@/lib/grupos-portal";
import { ensureGroupMeetingWindow } from "@/lib/meeting-series";
import { linkDoCanal } from "@/lib/slack";
import type { Member, Prisma } from "@prisma/client";

/**
 * Leituras (servidor) para as telas de grupos: Administração, Portal do
 * Voluntário, página do grupo e avisos do Portal do aluno. Permissões vêm de
 * grupos-portal.ts.
 */
type Pessoa = Parameters<typeof papelNoGrupo>[0];

export type ResumoGrupo = {
  id: string;
  nome: string;
  tipo: TipoGrupo;
  modalidade: string | null;
  responsaveis: string[];
  integrantes: number;
  atividades: number;
  proximoEncontro: string | null;
  papel?: "responsavel" | "integrante";
};

async function proximos(ids: string[]) {
  if (!ids.length) return new Map<string, Date>();
  await ensureGroupMeetingWindow(ids);
  const rows = await db.groupMeeting.findMany({
    where: { classGroupId: { in: ids }, status: "agendada", endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    select: { classGroupId: true, startsAt: true },
  });
  const mapa = new Map<string, Date>();
  for (const r of rows) if (!mapa.has(r.classGroupId)) mapa.set(r.classGroupId, r.startsAt);
  return mapa;
}

async function resumir(where: Prisma.ClassGroupWhereInput): Promise<ResumoGrupo[]> {
  const grupos = await db.classGroup.findMany({
    where: { ...where, arquivadoEm: null },
    select: {
      id: true,
      name: true,
      tipo: true,
      modalidade: true,
      memberships: { select: { role: true, member: { select: { name: true } } } },
      _count: { select: { atividades: { where: { status: "ativa" } } } },
    },
    orderBy: { name: "asc" },
  });
  const prox = await proximos(grupos.map((g) => g.id));
  return grupos
    .filter((g) => ehTipoGrupo(g.tipo))
    .map((g) => ({
      id: g.id,
      nome: g.name,
      tipo: g.tipo as TipoGrupo,
      modalidade: g.modalidade,
      responsaveis: g.memberships.filter((m) => m.role === "professor").map((m) => m.member.name),
      integrantes: g.memberships.filter((m) => m.role === "aluno").length,
      atividades: g._count.atividades,
      proximoEncontro: prox.get(g.id)?.toISOString() ?? null,
    }));
}

/** Administração: secretarias e GAFs da filial. */
export async function gruposDaFilial(schoolId: string, tipo: TipoGrupo | TipoGrupo[]) {
  return resumir({ schoolId, tipo: Array.isArray(tipo) ? { in: tipo } : tipo });
}

/** Grupos que a pessoa vê (Portal do Voluntário / Portal do aluno), com o papel dela. */
export async function meusGrupos(m: Pessoa, tipos?: TipoGrupo[]): Promise<ResumoGrupo[]> {
  const vinculos = await db.classMembership.findMany({
    where: { memberId: m.id, classGroup: { tipo: { in: tipos ?? (Object.keys(TIPOS_GRUPO) as TipoGrupo[]) }, arquivadoEm: null } },
    select: { classGroupId: true, role: true },
  });
  const ids = [...new Set(vinculos.map((v) => v.classGroupId))];
  const visiveis: string[] = [];
  for (const id of ids) if ((await papelNoGrupo(m, id)).podeVer) visiveis.push(id);
  const resumos = await resumir({ id: { in: visiveis } });
  return resumos.map((r) => ({ ...r, papel: vinculos.some((v) => v.classGroupId === r.id && v.role === "professor") ? "responsavel" : "integrante" }));
}

export type DetalheGrupo = Awaited<ReturnType<typeof detalheDoGrupo>>;

/** Página do grupo — null quando a pessoa não pode ver. */
export async function detalheDoGrupo(m: Pessoa, grupoId: string) {
  const papel: Papel & { tipo: TipoGrupo; schoolId: string } = await papelNoGrupo(m, grupoId);
  if (!papel.podeVer) return null;
  await ensureGroupMeetingWindow([grupoId]);
  const g = await db.classGroup.findUniqueOrThrow({
    where: { id: grupoId },
    select: {
      id: true,
      name: true,
      tipo: true,
      schoolId: true,
      descricao: true,
      modalidade: true,
      local: true,
      linkOnline: true,
      permiteAlunos: true,
      programa: true,
      arquivadoEm: true,
      slackChannelId: true,
      slackTeamId: true,
      school: { select: { name: true } },
      memberships: { select: { role: true, member: { select: { id: true, name: true, isMembroPrograma: true } } }, orderBy: { member: { name: "asc" } } },
      atividades: { orderBy: [{ status: "asc" }, { criadoEm: "asc" }] },
      meetingSeries: { select: { intervaloSemanas: true, untilSlot: true } },
    },
  });
  const encontros = await db.groupMeeting.findMany({
    where: { classGroupId: grupoId, startsAt: { gte: new Date(Date.now() - 60 * 864e5) } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      cancellationReason: true,
      publicDetails: true,
      presencas: papel.podeGerir ? { select: { memberId: true, participou: true, motivo: true, naoInformou: true } } : { where: { memberId: m.id }, select: { memberId: true, participou: true, motivo: true, naoInformou: true } },
    },
  });
  const nomes = new Map(g.memberships.map((x) => [x.member.id, x.member.name]));
  // Pedidos feitos pelo Portal do Aluno para este GAF (só a coordenação vê).
  const pedidos =
    g.tipo === "GAF" && papel.podeGerir
      ? (
          await db.gafRequest.findMany({
            where: { classGroupId: grupoId },
            orderBy: { createdAt: "asc" },
            select: { id: true, createdAt: true, member: { select: { name: true, isMembroPrograma: true } } },
          })
        ).map((p) => ({ id: p.id, nome: p.member.name, em: p.createdAt.toISOString(), membro: p.member.isMembroPrograma }))
      : [];
  return {
    agora: Date.now(),
    papel,
    pedidos,
    grupo: {
      ...g,
      tipo: g.tipo as TipoGrupo,
      frequencia: g.meetingSeries.find((s) => !s.untilSlot)?.intervaloSemanas ?? null,
      slack: linkDoCanal(g.slackTeamId, g.slackChannelId),
      responsaveis: g.memberships.filter((x) => x.role === "professor").map((x) => x.member),
      integrantes: g.memberships.filter((x) => x.role === "aluno").map((x) => x.member),
      atividades: g.atividades.map((a) => ({ ...a, nomesResponsaveis: a.responsaveis.map((r) => nomes.get(r) ?? "—") })),
    },
    encontros: encontros.map((e) => ({
      ...e,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      presencas: e.presencas.map((p) => ({ ...p, nome: nomes.get(p.memberId) ?? "—" })),
    })),
  };
}

/**
 * Avisos do Portal do aluno: encontros de hoje e encontros recentes em que a
 * pessoa ainda não disse se participou (GAF, GDVE e secretarias).
 */
export async function avisosDosGrupos(m: Pick<Member, "id"> & Parameters<typeof gruposDaAgenda>[0]) {
  const ids = (await gruposDaAgenda({ ...m, classMemberships: m.classMemberships.filter((cm) => (TIPOS_DO_PORTAL as readonly string[]).includes(cm.classGroup.tipo)) })).filter(Boolean);
  if (!ids.length) return { hoje: [], perguntas: [] };
  await ensureGroupMeetingWindow(ids);
  const agora = new Date();
  const hojeBR = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const fimDoDia = new Date(`${hojeBR}T23:59:59-03:00`);
  const [hoje, recentes] = await Promise.all([
    db.groupMeeting.findMany({
      where: { classGroupId: { in: ids }, status: "agendada", endsAt: { gte: agora }, startsAt: { lte: fimDoDia } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true, endsAt: true, classGroup: { select: { id: true, name: true, tipo: true, modalidade: true, local: true, linkOnline: true } } },
    }),
    db.groupMeeting.findMany({
      where: { classGroupId: { in: ids }, status: "agendada", startsAt: { lte: agora, gte: new Date(agora.getTime() - 7 * 864e5) }, presencas: { none: { memberId: m.id } } },
      orderBy: { startsAt: "desc" },
      take: 3,
      select: { id: true, title: true, startsAt: true, classGroup: { select: { name: true, tipo: true } } },
    }),
  ]);
  return {
    hoje: hoje.map((e) => ({ ...e, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString() })),
    perguntas: recentes.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() })),
  };
}
