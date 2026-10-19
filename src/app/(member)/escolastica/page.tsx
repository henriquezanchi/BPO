import { EscolasticaPanel } from "@/components/escolastica/escolastica-panel";
import { ABAS_ESCOLASTICA, AbasArea, MembrosEscolastica } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { exigirArea } from "@/lib/area-trabalho";
import { getDirectorDashboard } from "@/lib/director-data";

export const dynamic = "force-dynamic";

/**
 * Escolástica: pendências e solicitações de correção de cadastro, e a lista
 * de membros (sem dados financeiros — esses ficam na Economia). Entra o
 * Secretário de Escolástica (Mercúrio), o responsável pela secretaria no
 * Portal e a direção (areas-filial.ts).
 */
export default async function EscolasticaPage(props: { searchParams: Promise<{ aba?: string }> }) {
  const member = await exigirArea("escolastica", "/escolastica");
  const { aba = "pendencias" } = await props.searchParams;
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Escolástica</h1>
      <AbasArea
        base="/escolastica"
        atual={aba}
        abas={ABAS_ESCOLASTICA}
      />
      {aba === "membros" ? (
        <MembrosEscolastica schoolId={member.schoolId} data={await getDirectorDashboard(member.schoolId)} />
      ) : (
        <div className="max-w-3xl">
          <EscolasticaPanel schoolId={member.schoolId} />
        </div>
      )}
    </ShellTrabalho>
  );
}
