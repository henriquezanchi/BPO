import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { enviarPush } from "@/lib/push";

/**
 * Aniversários (pedido do usuário 06/11/2026): "notifique os professores e colegas de turma no dia, e mande os
 * parabéns para o aniversariante, em nome da Nova Acrópole". Às 8h no fuso de cada filial, pela rotina de avisos
 * (/api/cron/notificacoes, de 5 em 5 minutos). No mesmo horário vai o aviso de aniversário de casa (data de entrada
 * na escola, do Mercúrio). Cada aviso é reservado em PushEnviado antes do envio, então não se repete.
 */
export const HORA_ANIVERSARIOS = 8;

/** Dia e mês de hoje no fuso; quem nasceu em 29/02 comemora em 28/02 nos anos que não são bissextos. */
export function diasQueComemoramHoje(hojeIso: string): { mes: number; dia: number }[] {
  const [ano, mes, dia] = hojeIso.split("-").map(Number);
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  return mes === 2 && dia === 28 && !bissexto ? [{ mes, dia }, { mes: 2, dia: 29 }] : [{ mes, dia }];
}

/** Aniversário (vence) ou aniversário de casa de hoje; datas do Mercúrio são gravadas ao meio-dia UTC. */
export function celebracaoDeHoje(hoje: string, nascimento: Date | null, entrada: Date | null): { tipo: "aniversario" } | { tipo: "casa"; anos: number } | null {
  const dias = diasQueComemoramHoje(hoje);
  const cai = (d: Date | null) => !!d && dias.some((x) => x.mes === d.getUTCMonth() + 1 && x.dia === d.getUTCDate());
  if (cai(nascimento)) return { tipo: "aniversario" };
  const anos = entrada ? Number(hoje.slice(0, 4)) - entrada.getUTCFullYear() : 0;
  return cai(entrada) && anos >= 1 ? { tipo: "casa", anos } : null;
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;
/** Primeiro nome e o primeiro sobrenome que não é "de", "da", "dos"...: "MARIA DE TESTE SILVA" → "MARIA TESTE". */
const nomeCurto = (nome: string) => {
  const [primeiro, ...resto] = nome.trim().split(/\s+/);
  const sobrenome = resto.find((p) => !/^(de|da|do|das|dos|e)$/i.test(p));
  return [primeiro, sobrenome].filter(Boolean).join(" ");
};
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

/** Texto para colegas e professores: um aniversariante, ou vários da mesma turma no mesmo dia. */
export function textoParaColegas(nomes: string[]) {
  const n = [...new Set(nomes.map((x) => titulo(nomeCurto(x))))];
  if (n.length === 1) return { titulo: `Hoje é aniversário de ${n[0]}`, corpo: "Da sua turma. Que tal dar os parabéns?" };
  const lista = n.length === 2 ? `${n[0]} e ${n[1]}` : `${n.slice(0, -1).join(", ")} e ${n.at(-1)}`;
  return { titulo: "Aniversários na sua turma hoje", corpo: `${lista} fazem aniversário. Que tal dar os parabéns?` };
}

export function textoParabens(nome: string) {
  return {
    titulo: `Feliz aniversário, ${titulo(primeiroNome(nome))}!`,
    corpo: "A Nova Acrópole celebra com você o seu dia. Que este novo ciclo traga ainda mais sabedoria, coragem e ideais vividos.",
  };
}

export function textoTempoDeCasa(nome: string, anos: number) {
  return {
    titulo: `${anos} ${anos === 1 ? "ano" : "anos"} de Nova Acrópole!`,
    corpo: `${titulo(primeiroNome(nome))}, hoje faz ${anos} ${anos === 1 ? "ano" : "anos"} que você entrou na escola. Obrigado por fazer parte desta caminhada.`,
  };
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

/** Pessoas ativas da filial com a data (nascimento ou entrada) caindo hoje. Datas do Mercúrio são gravadas ao meio-dia UTC. */
async function quemComemora(schoolId: string, coluna: "birthDate" | "dataEntradaEscola", dias: { mes: number; dia: number }[]) {
  const col = Prisma.raw(`"${coluna}"`);
  const condicoes = dias.map((d) => Prisma.sql`(EXTRACT(MONTH FROM ${col}) = ${d.mes} AND EXTRACT(DAY FROM ${col}) = ${d.dia})`);
  return db.$queryRaw<{ id: string; name: string; data: Date }[]>`
    SELECT id, name, ${col} AS data FROM "Member"
    WHERE "schoolId" = ${schoolId} AND "mercurioAtivo" = true AND ${col} IS NOT NULL AND (${Prisma.join(condicoes, " OR ")})`;
}

export async function avisosDeAniversario(agora = new Date()) {
  const escolas = await db.school.findMany({ select: { id: true, uf: true, language: true } });
  let total = 0;
  for (const escola of escolas) {
    if (escola.language === "en") continue; // textos só em português por ora
    const fuso = fusoDaEscola(escola.uf);
    const partes = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hourCycle: "h23" }).formatToParts(agora).map((x) => [x.type, x.value]));
    if (Number(partes.hour) !== HORA_ANIVERSARIOS) continue;
    const hoje = `${partes.year}-${partes.month}-${partes.day}`;
    const dias = diasQueComemoramHoje(hoje);
    const [aniversariantes, entradas] = await Promise.all([quemComemora(escola.id, "birthDate", dias), quemComemora(escola.id, "dataEntradaEscola", dias)]);

    // 1. Parabéns ao aniversariante, em nome da Nova Acrópole.
    for (const p of aniversariantes) {
      if (!(await reservar(`aniversario:${p.id}:${hoje}`))) continue;
      total += (await enviarPush([p.id], { ...textoParabens(p.name), url: "/portal", etiqueta: `aniversario-${hoje}` })).pessoas;
    }

    // 2. Colegas e professores da turma: um aviso por pessoa, com todos os aniversariantes das turmas dela.
    if (aniversariantes.length) {
      const turmasDeles = await db.classMembership.findMany({
        where: { memberId: { in: aniversariantes.map((a) => a.id) }, role: "aluno", classGroup: { tipo: "turma", arquivadoEm: null, schoolId: escola.id } },
        select: { memberId: true, classGroupId: true },
      });
      const nomeDe = new Map(aniversariantes.map((a) => [a.id, a.name]));
      const daTurma = await db.classMembership.findMany({
        where: { classGroupId: { in: [...new Set(turmasDeles.map((t) => t.classGroupId))] }, member: { mercurioAtivo: true, pushSubscriptions: { some: {} } } },
        select: { memberId: true, classGroupId: true },
      });
      const paraQuem = new Map<string, Set<string>>();
      for (const v of daTurma) {
        for (const t of turmasDeles) {
          if (t.classGroupId !== v.classGroupId || t.memberId === v.memberId) continue;
          paraQuem.set(v.memberId, (paraQuem.get(v.memberId) ?? new Set()).add(nomeDe.get(t.memberId)!));
        }
      }
      for (const [quem, nomes] of paraQuem) {
        if (!(await reservar(`aniversario-turma:${quem}:${hoje}`))) continue;
        total += (await enviarPush([quem], { ...textoParaColegas([...nomes]), url: "/portal", etiqueta: `aniversario-turma-${hoje}` })).pessoas;
      }
    }

    // 3. Aniversário de casa (1 ano em diante).
    for (const p of entradas) {
      const anos = Number(hoje.slice(0, 4)) - p.data.getUTCFullYear();
      if (anos < 1 || !(await reservar(`casa:${p.id}:${hoje}`))) continue;
      total += (await enviarPush([p.id], { ...textoTempoDeCasa(p.name, anos), url: "/portal", etiqueta: `casa-${hoje}` })).pessoas;
    }
  }
  return total;
}
