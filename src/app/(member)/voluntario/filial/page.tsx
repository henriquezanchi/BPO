import { VisaoFilial } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { exigirArea } from "@/lib/area-trabalho";
import { getDirectorDashboard } from "@/lib/director-data";

export const dynamic = "force-dynamic";

/** Visão da filial (direção): o que era a Visão Geral do Painel da Direção, dentro da Área do Voluntário. */
export default async function VisaoFilialPage() {
  const member = await exigirArea("direcao", "/voluntario/filial");
  const data = await getDirectorDashboard(member.schoolId);
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Visão da filial</h1>
      <VisaoFilial schoolId={member.schoolId} data={data} />
    </ShellTrabalho>
  );
}
