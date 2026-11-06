import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { agoraNoFuso } from "@/lib/lembrete-aula";
import { podeVerOportunidades } from "@/lib/oportunidades";
import { somarDias, textoLembreteVoluntariado, textoVoluntariadoDaSemana } from "@/lib/oportunidades-comum";
import { enviarPush } from "@/lib/push";

/**
 * Voluntariado da semana (pedido do usuário 07/11/2026), sobre as Oportunidades de voluntariado que já existem:
 *  - segunda, 10h da filial: as tarefas pontuais dos próximos 7 dias que ainda têm vaga, para quem pode ver as
 *    oportunidades e ainda não se ofereceu;
 *  - véspera, 18h da filial: lembrete para quem foi aceito numa tarefa pontual de amanhã.
 * Na rotina de avisos (5 em 5 min); cada aviso reservado em PushEnviado.
 */
export const HORA_VOLUNTARIADO_SEMANA = 10;
export const HORA_LEMBRETE_VOLUNTARIADO = 18;

async function reservar(chave: string) {
  try {
    await db.pushEnviado.create({ data: { chave } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

export async function avisosDeVoluntariado(agora = new Date()) {
  let total = 0;
  const escolas = await db.school.findMany({ where: { language: { not: "en" }, oportunidadesVoluntariado: { some: { encerradaEm: null, tipo: "pontual" } } }, select: { id: true, uf: true } });
  for (const escola of escolas) {
    const { hoje, semana, minuto } = agoraNoFuso(agora, fusoDaEscola(escola.uf));

    // 1. Segunda de manhã: tarefas da semana com vaga.
    if (semana === 1 && minuto >= HORA_VOLUNTARIADO_SEMANA * 60 && minuto < 14 * 60 && (await reservar(`voluntariado-semana:${escola.id}:${hoje}`))) {
      const ops = await db.oportunidadeVoluntariado.findMany({
        where: { schoolId: escola.id, encerradaEm: null, tipo: "pontual", data: { gte: hoje, lte: somarDias(hoje, 6) }, OR: [{ abertaAte: null }, { abertaAte: { gte: hoje } }] },
        include: { interesses: { select: { memberId: true, status: true } } },
        orderBy: { data: "asc" },
      });
      const comVaga = ops.filter((o) => o.vagas == null || o.interesses.filter((i) => i.status === "aceito").length < o.vagas);
      if (comVaga.length) {
        const jaSeOfereceram = new Set(comVaga.flatMap((o) => o.interesses.filter((i) => i.status !== "desistiu").map((i) => i.memberId)));
        const pessoas = await db.member.findMany({ where: { schoolId: escola.id, mercurioAtivo: true, pushSubscriptions: { some: {} }, id: { notIn: [...jaSeOfereceram] } }, include: { school: true } });
        const destino: string[] = [];
        for (const p of pessoas) if (await podeVerOportunidades(p)) destino.push(p.id);
        total += (await enviarPush(destino, { ...textoVoluntariadoDaSemana(comVaga), url: "/portal?abrir=voluntariado", etiqueta: `voluntariado-semana-${hoje}` })).pessoas;
      }
    }

    // 2. Véspera, 18h: lembrete para quem foi aceito.
    if (minuto >= HORA_LEMBRETE_VOLUNTARIADO * 60 && minuto < 22 * 60) {
      const amanha = somarDias(hoje, 1);
      const aceitos = await db.interesseVoluntariado.findMany({
        where: { status: "aceito", oportunidade: { schoolId: escola.id, encerradaEm: null, tipo: "pontual", data: amanha } },
        select: { id: true, memberId: true, oportunidade: { select: { titulo: true, horario: true } } },
      });
      for (const a of aceitos) {
        if (!(await reservar(`voluntariado-vespera:${a.id}`))) continue;
        total += (await enviarPush([a.memberId], { ...textoLembreteVoluntariado(a.oportunidade), url: "/portal?abrir=voluntariado", etiqueta: `voluntariado-${a.id}` })).pessoas;
      }
    }
  }
  return total;
}
