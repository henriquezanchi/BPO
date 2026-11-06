import { db } from "@/lib/db";

/**
 * Catálogo de conquistas — decisão do usuário 2026-09-28: só reforço
 * positivo, nunca discriminação (diferente da ideia descartada de
 * "conteúdo exclusivo pra quem paga em dia"). Conquistas são permanentes:
 * uma vez ganha, não some se a condição deixar de valer depois (ex: perder
 * o streak não tira a conquista "3 meses em dia" já ganha).
 */
/** Marcos de tempo de casa além do primeiro ano (o de 1 ano é "um_ano_casa", mais antigo). */
export const ANOS_DE_CASA = [2, 3, 5, 7, 10, 15, 20, 25, 30, 35, 40] as const;

/** Anos completos desde a entrada (pelo calendário, não por 365 dias). */
export function anosDeCasa(entrada: Date, hoje = new Date()) {
  let anos = hoje.getUTCFullYear() - entrada.getUTCFullYear();
  if (hoje.getUTCMonth() < entrada.getUTCMonth() || (hoje.getUTCMonth() === entrada.getUTCMonth() && hoje.getUTCDate() < entrada.getUTCDate())) anos--;
  return Math.max(0, anos);
}

export const BADGE_CATALOG: Record<string, { label: string; description: string }> = {
  streak_3: { label: "3 meses em dia", description: "3 contribuições seguidas em dia" },
  streak_6: { label: "6 meses em dia", description: "6 contribuições seguidas em dia" },
  streak_12: { label: "1 ano em dia", description: "12 contribuições seguidas em dia" },
  streak_24: { label: "2 anos em dia", description: "24 contribuições seguidas em dia" },
  eventos_1: { label: "Primeiro evento", description: "Participou do primeiro evento da escola" },
  eventos_5: { label: "Presença de peso", description: "Participou de 5 eventos da escola" },
  eventos_10: { label: "Sempre por perto", description: "Participou de 10 eventos da escola" },
  voluntario: { label: "Coração voluntário", description: "Ofereceu apoio voluntário à escola" },
  gaf: { label: "Caminho filosófico", description: "Demonstrou interesse no GAF" },
  um_ano_casa: { label: "1 ano de casa", description: "1 ano desde que entrou na escola" },
  // Tempo de casa (pedido do usuário 06/11/2026): marcos depois do primeiro ano, com a data real (entrada + N anos).
  ...Object.fromEntries(ANOS_DE_CASA.map((n) => [`casa_${n}`, { label: `${n} anos de casa`, description: `${n} anos desde que entrou na escola` }])),
};

/**
 * Meses consecutivos "paga"/"isento" contando pra trás a partir do mais
 * recente sincronizado — quebra no primeiro "atrasado"/"em_branco". Não
 * fica limitado ao ano corrente (ao contrário do resto do Portal) porque
 * um streak real pode atravessar virada de ano.
 */
export async function calcularStreakMeses(memberId: string): Promise<number> {
  const statuses = await db.contributionMonthlyStatus.findMany({
    where: { memberId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  let streak = 0;
  for (const s of statuses) {
    if (s.status === "paga" || s.status === "isento") streak++;
    else break;
  }
  return streak;
}

const UM_ANO_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Confere se o membro passou a ser elegível a alguma conquista nova e
 * grava (best-effort, idempotente via skipDuplicates) — chamado a cada
 * carregamento do Portal (getMemberDashboard), custo baixo (poucas
 * queries simples) e garante que a conquista aparece assim que a condição
 * passa a valer, sem precisar de um job separado.
 */
export async function verificarEAtribuirConquistas(memberId: string): Promise<void> {
  const [streak, eventosParticipados, gaf, voluntario, member] = await Promise.all([
    calcularStreakMeses(memberId),
    db.eventRegistration.count({ where: { memberId, checkedIn: true } }),
    db.gafRequest.findFirst({ where: { memberId } }),
    db.volunteerOffer.findFirst({ where: { memberId } }),
    db.member.findUniqueOrThrow({ where: { id: memberId }, select: { createdAt: true, dataEntradaEscola: true } }),
  ]);

  const elegiveis: string[] = [];
  if (streak >= 3) elegiveis.push("streak_3");
  if (streak >= 6) elegiveis.push("streak_6");
  if (streak >= 12) elegiveis.push("streak_12");
  if (streak >= 24) elegiveis.push("streak_24");
  if (eventosParticipados >= 1) elegiveis.push("eventos_1");
  if (eventosParticipados >= 5) elegiveis.push("eventos_5");
  if (eventosParticipados >= 10) elegiveis.push("eventos_10");
  if (gaf) elegiveis.push("gaf");
  if (voluntario) elegiveis.push("voluntario");
  // Só com a data REAL de entrada na escola — nunca a de entrada no Portal.
  if (member.dataEntradaEscola && Date.now() - member.dataEntradaEscola.getTime() >= UM_ANO_MS) elegiveis.push("um_ano_casa");
  if (member.dataEntradaEscola) {
    const anos = anosDeCasa(member.dataEntradaEscola);
    for (const n of ANOS_DE_CASA) if (anos >= n) elegiveis.push(`casa_${n}`);
  }


  if (elegiveis.length === 0) return;
  await db.memberBadge.createMany({
    data: elegiveis.map((badgeType) => ({ memberId, badgeType })),
    skipDuplicates: true,
  });
}
