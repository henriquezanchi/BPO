import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fusoDaEscola } from "@/lib/fuso-escola";
import type { ResumoFilialDados } from "@/lib/mercurio-db/resumo-filial";
import { enviarPush } from "@/lib/push";
import { salaLegivel } from "@/lib/sala-legivel";

/**
 * Lembrete da aula do dia, com a sala (pedido do usuário 06/11/2026). Dia, horário e sala vêm da tabela `turmas` do
 * Mercúrio, pelo resumo diário da filial (ResumoFilial). Vai 3 horas antes da aula (nunca antes das 7h) para alunos e
 * professores da turma que ativaram as notificações. Roda na rotina de avisos (de 5 em 5 minutos); cada aviso é
 * reservado em PushEnviado, então não se repete.
 */
export const ANTECEDENCIA_HORAS = 3;
const PRIMEIRA_HORA = 7;

const DIAS: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

/** "QUINTA", "quinta-feira", "Sábado" → 0 a 6 (domingo = 0); null se não reconhece. */
export function diaDaSemana(dia: string): number | null {
  const d = dia
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .split(/[-\s]/)[0];
  return d in DIAS ? DIAS[d] : null;
}

/** Minutos do dia em que o lembrete sai: 3 h antes, não antes das 7h; null se o horário não é válido. */
export function minutoDoLembrete(horario: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(horario.trim());
  if (!m) return null;
  const aula = Number(m[1]) * 60 + Number(m[2]);
  if (aula <= 0 || aula >= 24 * 60) return null;
  return Math.min(aula, Math.max(PRIMEIRA_HORA * 60, aula - ANTECEDENCIA_HORAS * 60));
}

export function textoLembreteAula(turma: string, horario: string, sala: string | null) {
  const [h, min] = horario.slice(0, 5).split(":");
  const hora = min === "00" ? `${Number(h)}h` : `${Number(h)}h${min}`;
  const online = sala?.toLowerCase() === "online";
  const turmaLegivel = turma.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  return {
    titulo: `Aula hoje às ${hora}`,
    corpo: online ? `Turma ${turmaLegivel}, aula online.` : sala ? `Turma ${turmaLegivel}, sala ${sala}.` : `Turma ${turmaLegivel}.`,
  };
}

/** Data, dia da semana e minuto do dia no fuso da filial. */
export function agoraNoFuso(agora: Date, fuso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", weekday: "short", hourCycle: "h23" })
      .formatToParts(agora)
      .map((x) => [x.type, x.value]),
  );
  const semana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { hoje: `${p.year}-${p.month}-${p.day}`, semana, minuto: Number(p.hour) * 60 + Number(p.minute) };
}

async function reservar(chave: string) {
  try {
    await db.pushEnviado.create({ data: { chave } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

export async function lembretesDeAula(agora = new Date()) {
  const resumos = new Map((await db.resumoFilial.findMany({ select: { schoolId: true, dados: true } })).map((r) => [r.schoolId, r.dados as unknown as ResumoFilialDados]));
  const escolas = await db.school.findMany({ where: { id: { in: [...resumos.keys()] } }, select: { id: true, uf: true, language: true } });
  let total = 0;
  for (const escola of escolas) {
    if (escola.language === "en") continue;
    const { hoje, semana, minuto } = agoraNoFuso(agora, fusoDaEscola(escola.uf));
    const turmas = (resumos.get(escola.id)?.turmas?.lista ?? []).filter((t) => {
      const alvo = minutoDoLembrete(t.horario);
      const [h, m] = t.horario.split(":").map(Number);
      // Entre a hora do lembrete e o início da aula (a rotina roda de 5 em 5 minutos e pode atrasar).
      return diaDaSemana(t.dia) === semana && alvo !== null && minuto >= alvo && minuto < h * 60 + m;
    });
    for (const t of turmas) {
      const grupo = await db.classGroup.findFirst({
        where: { schoolId: escola.id, tipo: "turma", arquivadoEm: null, OR: [{ mercurioClassId: t.turma }, { name: t.turma }] },
        select: { id: true },
      });
      if (!grupo) continue;
      const vinculos = await db.classMembership.findMany({
        where: { classGroupId: grupo.id, member: { mercurioAtivo: true, pushSubscriptions: { some: {} } } },
        select: { memberId: true },
      });
      const texto = textoLembreteAula(t.turma, t.horario, salaLegivel(t.sala ?? null));
      for (const memberId of new Set(vinculos.map((v) => v.memberId))) {
        if (!(await reservar(`aula:${memberId}:${t.turma}:${hoje}`))) continue;
        total += (await enviarPush([memberId], { ...texto, url: "/portal", etiqueta: `aula-${hoje}` })).pessoas;
      }
    }
  }
  return total;
}
