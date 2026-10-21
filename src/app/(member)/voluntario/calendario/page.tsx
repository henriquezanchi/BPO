import { CalendarioTab } from "@/components/director/calendario-tab";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Calendário de atividades da filial com item próprio no menu (pedido do
 * usuário 2026-10-19: "quero que o calendário fique fácil"). Aulas, reuniões
 * de grupos, eventos da filial, nacionais/regionais e feriados.
 */
export default async function CalendarioPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/calendario");
  const areas = await areasNaFilial(member, member.schoolId);
  if (!areas.includes("eventos") && !areas.includes("direcao")) redirect("/voluntario");
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Calendário da filial</h1>
      <CalendarioTab schoolId={member.schoolId} />
    </ShellTrabalho>
  );
}
