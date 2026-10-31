import { temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { leiturasEmSequencia } from "@/lib/gaf-leituras";
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
      // Só os nomes dos responsáveis e a contagem de integrantes (antes vinham todas as linhas de vínculo).
      memberships: { where: { role: "professor" }, select: { member: { select: { name: true } } } },
      _count: { select: { atividades: { where: { status: "ativa" } }, memberships: { where: { role: "aluno" } } } },
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
      responsaveis: g.memberships.map((m) => m.member.name),
      integrantes: g._count.memberships,
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
  // Em paralelo (31/10/2026): cada conferência são várias consultas, e em série somavam quase 1 s no Portal.
  const papeis = await Promise.all(ids.map((id) => papelNoGrupo(m, id)));
  const visiveis = ids.filter((_, i) => papeis[i].podeVer);
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
  // Leituras do GAF (2026-10-26): texto de cada encontro, escolhido ou na sequência do cronograma.
  const leiturasGaf = g.tipo === "GAF" ? await leiturasDoGaf(grupoId) : null;
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
    leiturasGaf,
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

/** Encontros do GAF com a leitura de cada um: os 4 últimos e os próximos 8 (a sequência considera todos). */
async function leiturasDoGaf(grupoId: string) {
  const todos = await db.groupMeeting.findMany({
    where: { classGroupId: grupoId, status: { not: "cancelada" } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, leituraGaf: true },
  });
  const leituras = leiturasEmSequencia(todos);
  const agora = Date.now();
  const proximoIdx = todos.findIndex((e) => e.startsAt.getTime() >= agora - 3 * 60 * 60 * 1000);
  const inicio = proximoIdx < 0 ? Math.max(0, todos.length - 4) : Math.max(0, proximoIdx - 4);
  return todos.slice(inicio, inicio + 12).map((e) => {
    const l = leituras.get(e.id)!;
    return { id: e.id, startsAt: e.startsAt.toISOString(), passado: e.startsAt.getTime() < agora - 3 * 60 * 60 * 1000, origem: l.origem, texto: l.texto, escolha: e.leituraGaf };
  });
}

/**
 * O GAF como o integrante vê no Portal (pedido do usuário 2026-10-29: em vez de "Conhecer o GAF", o grupo em si):
 * participantes, próximo encontro, link (só se for online), texto para ler. A administração continua na página do
 * grupo (Portal do Voluntário). null quando a pessoa não pode ver.
 */
export async function gafNoPortal(m: Pessoa, grupoId: string) {
  const d = await detalheDoGrupo(m, grupoId);
  if (!d || d.grupo.tipo !== "GAF") return null;
  const agora = Date.now();
  const proximo = d.encontros.find((e) => new Date(e.endsAt).getTime() >= agora) ?? null;
  // Próximo cancelado: o aviso fica, e logo abaixo vem o encontro seguinte que vai acontecer (29/10/2026).
  const seguinte = proximo?.status === "cancelada" ? (d.encontros.find((e) => new Date(e.endsAt).getTime() >= agora && e.status !== "cancelada") ?? null) : null;
  const valendo = proximo?.status === "cancelada" ? seguinte : proximo;
  const leitura = valendo ? d.leiturasGaf?.find((l) => l.id === valendo.id) : null;
  const online = d.grupo.modalidade === "online" || d.grupo.modalidade === "misto";
  return {
    id: d.grupo.id,
    nome: d.grupo.name,
    descricao: d.grupo.descricao,
    modalidade: d.grupo.modalidade,
    frequencia: d.grupo.frequencia,
    link: online ? d.grupo.linkOnline : null,
    // Link para administrar só para quem gere o grupo E tem o Portal do Voluntário liberado (29/10/2026).
    podeGerir: d.papel.podeGerir && (await temAcessoVoluntario(m)),
    responsaveis: d.grupo.responsaveis.map((p) => p.name),
    integrantes: d.grupo.integrantes.map((p) => p.name),
    proximo: proximo && { inicio: proximo.startsAt, fim: proximo.endsAt, titulo: proximo.title, cancelado: proximo.status === "cancelada", motivo: proximo.cancellationReason, detalhes: proximo.publicDetails },
    seguinte: seguinte && { inicio: seguinte.startsAt, fim: seguinte.endsAt, detalhes: seguinte.publicDetails },
    leitura: leitura?.texto ? { titulo: leitura.texto.titulo, numero: leitura.texto.numero, url: `/gaf/texto/${leitura.texto.codigo}` } : leitura?.origem === "sem_leitura" ? { semLeitura: true as const } : null,
  };
}
export type GafNoPortal = NonNullable<Awaited<ReturnType<typeof gafNoPortal>>>;
