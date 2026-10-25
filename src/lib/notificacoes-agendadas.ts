import { comAcessoVoluntario } from "@/lib/acesso-voluntario";
import { areasNaFilial, type AreaFilial } from "@/lib/areas-filial";
import { fusoDaEscola } from "@/lib/atendimentos";
import { db } from "@/lib/db";
import { agendaUlissesBranchWhere, eventAudienceWhere, eventScopeWhere } from "@/lib/event-policy";
import { TIPOS_DO_PORTAL, ehDeAlunos } from "@/lib/grupos-comum";
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
  if (!ehDeAlunos(grupo.tipo)) {
    const liberados = await comAcessoVoluntario(ids);
    ids = ids.filter((id) => liberados.has(id));
  }
  cache.set(grupo.id, ids);
  return ids;
}

export async function avisosDeEncontros() {
  const grupos = await db.classGroup.findMany({ where: { tipo: { in: [...TIPOS_DO_PORTAL] }, arquivadoEm: null }, select: { id: true } });
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

// ───────────────────────── Eventos: novidades e resumo da semana ─────────────────────────
// Pedido do usuário 2026-10-25: avisar de todos os eventos (do Portal e do Ulisses) para quem tem o
// público certo — a mesma regra da Agenda (eventosQueAPessoaVe) —, sem sobrecarregar:
//  - eventos novos chegam numa notificação só por rodada ("3 eventos novos na Agenda"), entre 8h e 21h
//    (a importação do Ulisses é às 6h; o aviso espera o horário);
//  - toda segunda-feira, a partir das 8h, um resumo com os eventos da semana.

const camposPublico = { id: true, nivel: true, isMembroPrograma: true, isProvacionista: true, isHD: true, isDirigente: true, isFV: true, emProvacionismo: true, school: { select: { id: true, uf: true } } } as const;
type PessoaAviso = Prisma.MemberGetPayload<{ select: typeof camposPublico }>;

/** Eventos publicados que a pessoa vê na Agenda (mesmo filtro de member-data.ts). */
function eventosQueAPessoaVe(p: PessoaAviso): Prisma.EventWhereInput {
  return {
    status: "publicado",
    OR: [...(eventScopeWhere(p.school).OR ?? []), { scope: { in: ["nacional", "regional"] } }],
    AND: [eventAudienceWhere(p), agendaUlissesBranchWhere(p.school.id)],
  };
}

/** Partes da data/hora em Brasília. */
function agoraEmBrasilia(agora: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hourCycle: "h23", weekday: "short" })
      .formatToParts(agora)
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), segunda: p.weekday === "Mon" };
}

function linhaDoEvento(e: { title: string; startsAt: Date; allDay: boolean }) {
  const dia = e.startsAt.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
  const hora = e.allDay ? "" : ` ${e.startsAt.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}`;
  return { quando: `${dia}${hora}`, linha: `${dia}${hora} · ${e.title}` };
}

/** Um evento: o título no topo; vários: a contagem no topo e até 3 linhas no corpo. */
export function textoDeEventos(lista: { title: string; startsAt: Date; allDay: boolean }[], umTitulo: (t: string) => string, variosTitulo: (n: number) => string) {
  if (lista.length === 1) return { titulo: umTitulo(lista[0].title), corpo: `${linhaDoEvento(lista[0]).quando}. Veja na Agenda.` };
  const linhas = lista.slice(0, 3).map((e) => linhaDoEvento(e).linha);
  if (lista.length > 3) linhas.push(`e mais ${lista.length - 3}`);
  return { titulo: variosTitulo(lista.length), corpo: linhas.join("\n") };
}

export async function avisosDeEventosNovos(agora = new Date()) {
  const { hora, data } = agoraEmBrasilia(agora);
  if (hora < 8 || hora >= 21) return 0;
  const recentes = await db.event.findMany({
    where: { status: "publicado", startsAt: { gt: agora }, createdAt: { gte: new Date(agora.getTime() - 36 * 60 * MIN) } },
    select: { id: true },
  });
  if (!recentes.length) return 0;
  const avisados = new Set((await db.pushEnviado.findMany({ where: { chave: { in: recentes.map((e) => `evento:${e.id}`) } } })).map((k) => k.chave));
  const novos: string[] = [];
  for (const e of recentes) if (!avisados.has(`evento:${e.id}`) && (await reservar(`evento:${e.id}`))) novos.push(e.id);
  if (!novos.length) return 0;

  const pessoas = await db.member.findMany({ where: comPush, select: camposPublico });
  let total = 0;
  for (const p of pessoas) {
    const lista = await db.event.findMany({ where: { id: { in: novos }, ...eventosQueAPessoaVe(p) }, orderBy: { startsAt: "asc" }, select: { title: true, startsAt: true, allDay: true } });
    if (!lista.length) continue;
    const texto = textoDeEventos(lista, (t) => `Evento novo: ${t}`, (n) => `${n} eventos novos na Agenda`);
    total += (await enviarPush([p.id], { ...texto, url: "/portal", etiqueta: `eventos-novos-${data}` })).pessoas;
  }
  return total;
}

export async function resumoDaSemana(agora = new Date()) {
  const { segunda, hora, data } = agoraEmBrasilia(agora);
  if (!segunda || hora < 8 || hora >= 12) return 0;
  const fimDaSemana = new Date(new Date(`${data}T00:00:00-03:00`).getTime() + 7 * 24 * 60 * MIN);
  const pessoas = await db.member.findMany({ where: comPush, select: camposPublico });
  let total = 0;
  for (const p of pessoas) {
    if (!(await reservar(`semana:${p.id}:${data}`))) continue;
    const lista = await db.event.findMany({
      where: { startsAt: { gte: agora, lt: fimDaSemana }, ...eventosQueAPessoaVe(p) },
      orderBy: { startsAt: "asc" },
      select: { title: true, startsAt: true, allDay: true },
    });
    if (!lista.length) continue;
    const texto = textoDeEventos(lista, (t) => `Esta semana: ${t}`, (n) => `${n} eventos nesta semana`);
    total += (await enviarPush([p.id], { ...texto, url: "/portal", etiqueta: `semana-${data}` })).pessoas;
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

// ───────────────────────── Conversas individuais com o instrutor ─────────────────────────
// Pedido do usuário 2026-10-25: aviso para o aluno e o instrutor 2 h antes (cada conversa, uma vez).

export async function avisosDeAtendimentos() {
  const agora = new Date();
  const proximas = await db.atendimentoReserva.findMany({
    where: { status: "marcada", lembreteEnviadoEm: null, alunoId: { not: null }, inicio: { gt: agora, lte: new Date(agora.getTime() + 120 * MIN) } },
    include: { aluno: { select: { name: true } }, instrutor: { select: { name: true, school: { select: { uf: true } } } } },
  });
  let pessoas = 0;
  for (const r of proximas) {
    const marcado = await db.atendimentoReserva.updateMany({ where: { id: r.id, lembreteEnviadoEm: null }, data: { lembreteEnviadoEm: agora } });
    if (!marcado.count) continue;
    const hora = r.inicio.toLocaleTimeString("pt-BR", { timeZone: fusoDaEscola(r.instrutor.school.uf), hour: "2-digit", minute: "2-digit" });
    const onde = r.modalidade === "online" ? (r.linkOnline ? "Online: toque para entrar." : "Online.") : r.local ? `Local: ${r.local}.` : "Na escola.";
    const nome = (n: string) => n.split(" ").slice(0, 2).join(" ");
    const a = await enviarPush([r.alunoId!], { titulo: `Conversa com ${nome(r.instrutor.name)} às ${hora}`, corpo: onde, url: r.modalidade === "online" && r.linkOnline ? r.linkOnline : "/atendimentos", etiqueta: `atendimento-${r.id}` });
    const i = await enviarPush([r.instrutorId], { titulo: `Conversa com ${nome(r.aluno?.name ?? "aluno")} às ${hora}`, corpo: r.assunto ? `Assunto: ${r.assunto.slice(0, 120)}` : onde, url: "/professor/atendimentos", etiqueta: `atendimento-${r.id}` });
    pessoas += a.pessoas + i.pessoas;
  }
  return { conversas: proximas.length, pessoas };
}
