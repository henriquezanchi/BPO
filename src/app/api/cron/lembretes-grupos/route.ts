import { comAcessoVoluntario } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { ensureGroupMeetingWindow } from "@/lib/meeting-series";
import { enviarPush, pushConfigurado } from "@/lib/push";
import crypto from "node:crypto";

/**
 * Notificações dos encontros de GAF, GDVE e secretarias (pedido do usuário
 * 2026-10-19: "notificar no dia e horário; depois perguntar se a pessoa
 * participou"). Agendada em vercel.json a cada 5 minutos:
 *  - até 30 min antes do início: lembrete (encontro online abre a chamada ao tocar);
 *  - até 3 h depois do fim: "Você participou?" para quem ainda não respondeu.
 * Cada encontro é marcado (lembreteEnviadoEm / presencaPerguntadaEm) antes do
 * envio, então duas execuções simultâneas não mandam em dobro.
 * Quem recebe: os mesmos que veem o encontro na Agenda (gruposDaAgenda):
 * GAF, qualquer integrante ativo; GDVE e secretarias, só com acesso de voluntário liberado.
 */
export const maxDuration = 120;

const ANTES_MS = 30 * 60_000;
const DEPOIS_MS = 3 * 60 * 60_000;

function autorizado(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

type Grupo = { id: string; tipo: string };

async function integrantes(grupo: Grupo, cache: Map<string, string[]>) {
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

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  if (!pushConfigurado()) return Response.json({ ok: true, aviso: "Chaves VAPID não configuradas; nada enviado." });

  const grupos = await db.classGroup.findMany({ where: { tipo: { in: ["GAF", "GDVE", "SEC"] }, arquivadoEm: null }, select: { id: true } });
  const ids = grupos.map((g) => g.id);
  if (!ids.length) return Response.json({ ok: true, lembretes: 0, perguntas: 0 });
  await ensureGroupMeetingWindow(ids);

  const agora = new Date();
  const cache = new Map<string, string[]>();
  const grupoSel = { select: { id: true, tipo: true, name: true, modalidade: true, local: true, linkOnline: true } } as const;

  const [proximos, terminados] = await Promise.all([
    db.groupMeeting.findMany({
      where: { classGroupId: { in: ids }, status: "agendada", lembreteEnviadoEm: null, startsAt: { gt: agora, lte: new Date(agora.getTime() + ANTES_MS) } },
      include: { classGroup: grupoSel },
    }),
    db.groupMeeting.findMany({
      where: { classGroupId: { in: ids }, status: "agendada", presencaPerguntadaEm: null, endsAt: { lte: agora, gte: new Date(agora.getTime() - DEPOIS_MS) } },
      include: { classGroup: grupoSel, presencas: { select: { memberId: true } } },
    }),
  ]);

  let lembretes = 0;
  for (const e of proximos) {
    const marcado = await db.groupMeeting.updateMany({ where: { id: e.id, lembreteEnviadoEm: null }, data: { lembreteEnviadoEm: agora } });
    if (!marcado.count) continue;
    const g = e.classGroup;
    const hora = e.startsAt.toLocaleTimeString("pt-BR", { timeZone: e.timeZone || "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
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
    const r = await enviarPush(faltam, {
      titulo: `Você participou? · ${e.classGroup.name}`,
      corpo: `Conte se esteve em "${e.title}". Leva um toque.`,
      url: "/portal",
      etiqueta: `presenca-${e.id}`,
    });
    perguntas += r.pessoas;
  }

  const resultado = { ok: true, encontrosLembrados: proximos.length, lembretes, encontrosPerguntados: terminados.length, perguntas };
  if (proximos.length || terminados.length) console.log(JSON.stringify({ lembretesGrupos: resultado }));
  return Response.json(resultado);
}
