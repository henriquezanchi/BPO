import { comAcessoVoluntario } from "@/lib/acesso-voluntario";
import { areasNaFilial, type AreaFilial } from "@/lib/areas-filial";
import { db } from "@/lib/db";
import { eventoAlcancaFilial, publicosDaPessoa } from "@/lib/event-policy";
import { ensureGroupMeetingWindow } from "@/lib/meeting-series";
import { enviarPush } from "@/lib/push";
import { Prisma } from "@prisma/client";

/**
 * Avisos push agendados (2026-10-21), rodados pela rotina de 5 em 5 minutos
 * (/api/cron/notificacoes). Cada aviso é marcado antes do envio (em
 * GroupMeeting ou em PushEnviado), então uma nova rodada não repete.
 */

const MIN = 60_000;
const TZ = "America/Sao_Paulo";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Reserva a chave do aviso; false se outra rodada já enviou. */
async function reservar(chave: string) {
  try {
    await db.pushEnviado.create({ data: { chave } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

/** Só quem já ativou as notificações interessa para os avisos (poupa consultas). */
const comPush = { pushSubscriptions: { some: {} }, mercurioAtivo: true } as const;

// ───────────────────────── Encontros de GAF, GDVE e secretarias ─────────────────────────
// Pedido do usuário 2026-10-19: "notificar no dia e horário; depois perguntar se a pessoa participou".
// Quem recebe: os mesmos que veem o encontro na Agenda (gruposDaAgenda): GAF, qualquer integrante
// ativo; GDVE e secretarias, só com acesso de voluntário liberado.

async function integrantes(grupo: { id: string; tipo: string }, cache: Map<string, string[]>) {
  const pronto = cache.get(grupo.id);
  if (pronto) return pronto;
  const vinculos = await db.classMembership.findMany({ where: { classGroupId: grupo.id, member: { mercurioAtivo: true } }, select: { memberId: true } });
  let ids = [...new Set(vinculos.map((v) => v.memberId))];
  if (grupo.tipo !== "GAF") {
    const liberados = await comAcessoVoluntario(ids);
    ids = ids.filter((id) => liberados.has(id));
  }
  cache.set(grupo.id, ids);
  return ids;
}

export async function avisosDeEncontros() {
  const grupos = await db.classGroup.findMany({ where: { tipo: { in: ["GAF", "GDVE", "SEC"] }, arquivadoEm: null }, select: { id: true } });
  const ids = grupos.map((g) => g.id);
  if (!ids.length) return { lembretes: 0, perguntas: 0 };
  await ensureGroupMeetingWindow(ids);

  const agora = new Date();
  const cache = new Map<string, string[]>();
  const grupoSel = { select: { id: true, tipo: true, name: true, modalidade: true, local: true, linkOnline: true } } as const;
  const [proximos, terminados] = await Promise.all([
    // Até 30 min antes do início.
    db.groupMeeting.findMany({
      where: { classGroupId: { in: ids }, status: "agendada", lembreteEnviadoEm: null, startsAt: { gt: agora, lte: new Date(agora.getTime() + 30 * MIN) } },
      include: { classGroup: grupoSel },
    }),
    // Até 3 h depois do fim.
    db.groupMeeting.findMany({
      where: { classGroupId: { in: ids }, status: "agendada", presencaPerguntadaEm: null, endsAt: { lte: agora, gte: new Date(agora.getTime() - 180 * MIN) } },
      include: { classGroup: grupoSel, presencas: { select: { memberId: true } } },
    }),
  ]);

  let lembretes = 0;
  for (const e of proximos) {
    const marcado = await db.groupMeeting.updateMany({ where: { id: e.id, lembreteEnviadoEm: null }, data: { lembreteEnviadoEm: agora } });
    if (!marcado.count) continue;
    const g = e.classGroup;
    const hora = e.startsAt.toLocaleTimeString("pt-BR", { timeZone: e.timeZone || TZ, hour: "2-digit", minute: "2-digit" });
    const online = g.modalidade === "online" && g.linkOnline;
    const onde = online ? "Online: toque para entrar na chamada." : g.modalidade === "misto" ? "Presencial ou online." : g.local ? `Local: ${g.local}.` : "";
    const r = await enviarPush(await integrantes(g, cache), {
      titulo: `${e.title} · ${g.name}`,
      corpo: `Começa às ${hora}. ${onde}${e.fullUniform ? " Traje completo." : ""}`.trim(),
      url: online ? g.linkOnline! : "/portal",
      etiqueta: `encontro-${e.id}`,
    });
    lembretes += r.pessoas;
  }

  let perguntas = 0;
  for (const e of terminados) {
    const marcado = await db.groupMeeting.updateMany({ where: { id: e.id, presencaPerguntadaEm: null }, data: { presencaPerguntadaEm: agora } });
    if (!marcado.count) continue;
    const responderam = new Set(e.presencas.map((p) => p.memberId));
    const faltam = (await integrantes(e.classGroup, cache)).filter((id) => !responderam.has(id));
    const r = await enviarPush(faltam, { titulo: `Você participou? · ${e.classGroup.name}`, corpo: `Conte se esteve em "${e.title}". Leva um toque.`, url: "/portal", etiqueta: `presenca-${e.id}` });
    perguntas += r.pessoas;
  }
  return { lembretes, perguntas };
}

// ───────────────────────── Pedidos novos para a Escolástica e a Economia ─────────────────────────

/** Quem da própria filial tem a área (mesma regra do menu da Área do Voluntário) e ativou as notificações. */
async function responsaveisDaArea(schoolId: string, area: AreaFilial) {
  const candidatos = await db.member.findMany({ where: { schoolId, ...comPush } });
  const tem = await Promise.all(candidatos.map(async (m) => ((await areasNaFilial(m, schoolId)).includes(area) ? m.id : null)));
  return tem.filter((id): id is string => !!id);
}

async function avisarPedidos(
  pedidos: { id: string; member: { name: string; schoolId: string } }[],
  tipo: "cadastro" | "composicao",
) {
  const novos: typeof pedidos = [];
  for (const p of pedidos) if (await reservar(`pedido-${tipo}:${p.id}`)) novos.push(p);
  const porFilial = Map.groupBy(novos, (p) => p.member.schoolId);
  let pessoas = 0;
  for (const [schoolId, lista] of porFilial) {
    const area = tipo === "cadastro" ? "escolastica" : "economia";
    const quem = lista.length === 1 ? lista[0].member.name.split(" ").slice(0, 2).join(" ") : `${lista.length} pessoas`;
    const r = await enviarPush(await responsaveisDaArea(schoolId, area), {
      titulo: tipo === "cadastro" ? "Alteração de cadastro aguardando" : "Pedido de contribuição aguardando",
      corpo: tipo === "cadastro" ? `${quem} pediu para alterar o cadastro.` : `${quem} pediu para diminuir ou remover um item da contribuição.`,
      url: tipo === "cadastro" ? "/escolastica" : "/economia?aba=composicao",
      etiqueta: `pedidos-${tipo}-${schoolId}`,
    });
    pessoas += r.pessoas;
  }
  return pessoas;
}

export async function avisosDePedidosNovos() {
  const desde = new Date(Date.now() - 24 * 60 * MIN);
  const sel = { id: true, member: { select: { name: true, schoolId: true } } } as const;
  const [cadastro, composicao] = await Promise.all([
    db.contactChangeLog.findMany({ where: { status: "pendente", createdAt: { gte: desde } }, select: sel }),
    db.compositionChangeRequest.findMany({ where: { status: "pendente", createdAt: { gte: desde } }, select: sel }),
  ]);
  return { cadastro: await avisarPedidos(cadastro, "cadastro"), composicao: await avisarPedidos(composicao, "composicao") };
}

// ───────────────────────── Evento novo ─────────────────────────
// Eventos internos (source "manual") publicados nas últimas 2 h; chega a quem pode ver e se
// inscrever (público do evento + filiais a que foi aberto). Eventos do Ulisses não entram.

export async function avisosDeEventosNovos() {
  const agora = new Date();
  const eventos = await db.event.findMany({
    where: { source: "manual", status: "publicado", startsAt: { gt: agora }, createdAt: { gte: new Date(agora.getTime() - 120 * MIN) } },
    select: { id: true, title: true, startsAt: true, schoolId: true, abertoA: true, abertoValores: true, publicos: true, school: { select: { name: true } } },
  });
  const novos = [];
  for (const e of eventos) if (await reservar(`evento:${e.id}`)) novos.push(e);
  if (!novos.length) return 0;

  const pessoas = await db.member.findMany({
    where: comPush,
    select: { id: true, nivel: true, isMembroPrograma: true, isProvacionista: true, isHD: true, isDirigente: true, isFV: true, emProvacionismo: true, school: { select: { id: true, uf: true } } },
  });
  let total = 0;
  for (const e of novos) {
    const destino = pessoas.filter((p) => eventoAlcancaFilial(e, p.school) && publicosDaPessoa(p).some((x) => e.publicos.includes(x))).map((p) => p.id);
    const dia = e.startsAt.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
    const hora = e.startsAt.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
    const filial = e.school?.name.replace(/^Nova Acrópole - /, "");
    const r = await enviarPush(destino, { titulo: `Evento novo: ${e.title}`, corpo: `${dia} às ${hora}${filial ? ` · ${filial}` : ""}. Veja na Agenda e inscreva-se.`, url: "/portal", etiqueta: `evento-${e.id}` });
    total += r.pessoas;
  }
  return total;
}

// ───────────────────────── Vencimento da contribuição ─────────────────────────
// Dia 10 (mesma convenção do Portal e do Pix Automático). Lembrete 3 dias antes (dia 7) e no dia,
// entre 9h e 20h de Brasília, para quem ainda não pagou o mês. Só filiais em que o pagamento pelo
// Portal está liberado (School.mercurioEscrita); quem tem Pix Automático ativo, está isento ou
// negociando não recebe.

const DIA_VENCIMENTO = 10;

export async function avisosDeVencimento() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date()).map((p) => [p.type, Number(p.value)]));
  const { year: ano, month: mes, day: dia, hour: hora } = partes;
  if (hora < 9 || hora >= 20) return 0;
  const tipo = dia === DIA_VENCIMENTO - 3 ? "d3" : dia === DIA_VENCIMENTO ? "d0" : null;
  if (!tipo) return 0;

  const membros = await db.member.findMany({
    where: {
      ...comPush,
      school: { mercurioEscrita: true },
      status: { notIn: ["negociando", "isento"] },
      // NOT simples excluiria também quem nunca teve Pix Automático (coluna nula).
      OR: [{ pixAutomaticStatus: null }, { pixAutomaticStatus: { not: "ACTIVE" } }],
      monthlyStatus: { none: { year: ano, month: mes, status: { in: ["paga", "isento"] } } },
    },
    select: { id: true },
  });
  let total = 0;
  for (const m of membros) {
    if (!(await reservar(`vencimento:${m.id}:${ano}-${String(mes).padStart(2, "0")}:${tipo}`))) continue;
    const r = await enviarPush([m.id], {
      titulo: tipo === "d0" ? "Sua contribuição vence hoje" : `Contribuição de ${MESES[mes - 1]} vence dia ${DIA_VENCIMENTO}`,
      corpo: "Pague pelo Portal com Pix em poucos segundos. Se já pagou, desconsidere.",
      url: "/portal",
      etiqueta: `vencimento-${ano}-${mes}`,
    });
    total += r.pessoas;
  }
  return total;
}

// ───────────────────────── Avisos de quem se inscreveu em evento ─────────────────────────
// O Portal já planejava esses avisos por inscrição (EventNotice, eventNoticePlan em
// event-policy.ts) com status "aguardando_canal"; desde 2026-10-22 o canal é o push.
// Cada aviso tem uma janela de validade: fora dela vira "expirado" (não manda lembrete velho).
// Quem não ativou as notificações fica "sem_canal".

const JANELA_MS: Record<string, number> = {
  inscricao: 24 * 60 * MIN,
  vespera: 12 * 60 * MIN,
  uma_hora: 50 * MIN,
  avaliar_presenca: 2 * 24 * 60 * MIN,
  cancelamento: 2 * 24 * 60 * MIN,
};

export async function avisosDeEventosInscritos() {
  const agora = new Date();
  const pendentes = await db.eventNotice.findMany({
    where: { status: "aguardando_canal", dueAt: { lte: agora } },
    take: 300,
    orderBy: { dueAt: "asc" },
    include: {
      registration: {
        select: {
          memberId: true,
          paid: true,
          amount: true,
          event: { select: { id: true, title: true, startsAt: true, location: true, status: true, lancheCompartilhado: true, refundOnCancellation: true, price: true } },
        },
      },
    },
  });
  let enviados = 0;
  for (const n of pendentes) {
    const { event: e, memberId } = n.registration;
    const vencido = agora.getTime() - n.dueAt.getTime() > (JANELA_MS[n.kind] ?? 24 * 60 * MIN);
    const jaComecou = e.startsAt <= agora;
    const foraDeHora = vencido || ((n.kind === "vespera" || n.kind === "uma_hora") && (jaComecou || e.status !== "publicado"));
    if (foraDeHora) {
      await db.eventNotice.updateMany({ where: { id: n.id, status: "aguardando_canal" }, data: { status: "expirado" } });
      continue;
    }
    // Reserva o aviso antes de enviar: duas rodadas simultâneas não mandam em dobro.
    const marcado = await db.eventNotice.updateMany({ where: { id: n.id, status: "aguardando_canal" }, data: { status: "processando" } });
    if (!marcado.count) continue;

    // Inscrição paga: a confirmação já saiu na hora do pagamento (confirmEventPayment).
    if (n.kind === "inscricao" && Number(n.registration.amount ?? 0) > 0) {
      await db.eventNotice.update({ where: { id: n.id }, data: { status: "enviado", sentAt: agora } });
      continue;
    }

    const dia = e.startsAt.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
    const hora = e.startsAt.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
    const onde = e.location ? ` · ${e.location}` : "";
    const lanche = e.lancheCompartilhado ? " Lanche compartilhado: leve algo para partilhar." : "";
    const textos: Record<string, { titulo: string; corpo: string; url: string }> = {
      inscricao: { titulo: "Inscrição confirmada", corpo: `Você está inscrito em "${e.title}" (${dia} às ${hora}).`, url: "/eventos" },
      vespera: { titulo: `Amanhã: ${e.title}`, corpo: `Às ${hora}${onde}.${lanche}`, url: "/eventos" },
      uma_hora: { titulo: `Começa em 1 hora: ${e.title}`, corpo: `Às ${hora}${onde}.`, url: "/eventos" },
      avaliar_presenca: { titulo: `Você foi a "${e.title}"?`, corpo: "Conte se participou. Leva um toque.", url: "/eventos" },
      cancelamento: {
        titulo: `Evento cancelado: ${e.title}`,
        corpo: e.refundOnCancellation && n.registration.paid && Number(e.price) > 0 ? "O valor pago será devolvido automaticamente." : "Em caso de dúvida, fale com a secretaria.",
        url: "/eventos",
      },
    };
    const t = textos[n.kind];
    if (!t) {
      await db.eventNotice.update({ where: { id: n.id }, data: { status: "aguardando_canal" } });
      continue;
    }
    const r = await enviarPush([memberId], { ...t, etiqueta: `evento-${n.kind}-${e.id}` }).catch(() => ({ pessoas: 0, aparelhos: 0 }));
    await db.eventNotice.update({ where: { id: n.id }, data: r.aparelhos ? { status: "enviado", sentAt: agora } : { status: "sem_canal" } });
    if (r.aparelhos) enviados++;
  }
  return enviados;
}
