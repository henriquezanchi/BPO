import { db } from "@/lib/db";

export const DIAS_SEMANA = ["domingos", "segundas-feiras", "terças-feiras", "quartas-feiras", "quintas-feiras", "sextas-feiras", "sábados"];
export const horaLegivel = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

export type AberturaConvite = { id: string; titulo: string; primeiraAula: Date; diaSemana: number; inicioMinuto: number; sala: string; matriculaToken: string | null };

/**
 * Próximas aberturas de turma da filial para o convite (Indicar um amigo, 07/11/2026): planejadas ou em curso, com a
 * primeira aula de hoje em diante. O link de matrícula só vai quando as matrículas pelo site estão abertas.
 */
export async function proximasAberturas(schoolId: string): Promise<AberturaConvite[]> {
  const hoje = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) + "T00:00:00-03:00");
  const lista = await db.aberturaTurma.findMany({
    where: { schoolId, status: { in: ["planejada", "em_curso"] }, primeiraAula: { gte: hoje } },
    orderBy: { primeiraAula: "asc" },
    take: 4,
    select: { id: true, titulo: true, primeiraAula: true, diaSemana: true, inicioMinuto: true, sala: true, matriculaToken: true, matriculaAberta: true },
  });
  return lista.map((a) => ({ ...a, matriculaToken: a.matriculaAberta ? a.matriculaToken : null }));
}

export function quandoComeca(a: Pick<AberturaConvite, "primeiraAula" | "diaSemana" | "inicioMinuto">) {
  const dia = a.primeiraAula.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long" });
  return `Começa em ${dia} · ${DIAS_SEMANA[a.diaSemana]}, ${horaLegivel(a.inicioMinuto)}`;
}
