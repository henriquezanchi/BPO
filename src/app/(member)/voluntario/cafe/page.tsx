import { CafeArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { exigirArea } from "@/lib/area-trabalho";
import { getDirectorDashboard } from "@/lib/director-data";

export const dynamic = "force-dynamic";

/** Café: Caixa Fortuna (antes no Painel da Direção). */
export default async function CafePage() {
  const member = await exigirArea("cafe", "/voluntario/cafe");
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Café · Caixa Fortuna</h1>
      <CafeArea schoolId={member.schoolId} data={await getDirectorDashboard(member.schoolId)} />
    </ShellTrabalho>
  );
}
