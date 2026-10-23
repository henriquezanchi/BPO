import { AreaSecretaria } from "@/components/secretarias-rede/area-secretaria";
import { CalendarioTab } from "@/components/director/calendario-tab";
import { EventosTab } from "@/components/director/eventos-tab";
import { AbasArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { exigirArea } from "@/lib/area-trabalho";
import { getDirectorDashboard } from "@/lib/director-data";

export const dynamic = "force-dynamic";

/** Eventos: gestão de eventos e calendário da filial (antes no Painel da Direção). */
export default async function EventosAreaPage(props: { searchParams: Promise<{ aba?: string }> }) {
  if((await props.searchParams).aba==='orientacoes')return <ShellTrabalho><AreaSecretaria secretaria="Eventos"/></ShellTrabalho>;
  const member = await exigirArea("eventos", "/voluntario/eventos");
  const { aba = "eventos" } = await props.searchParams;
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Eventos</h1>
      <AbasArea
        base="/voluntario/eventos"
        atual={aba}
        abas={[
          ["orientacoes", "Orientações e gestão"],
          ["eventos", "Gestão de eventos"],
          ["calendario", "Calendário", "/voluntario/calendario"],
        ]}
      />
      {aba === "calendario" ? <CalendarioTab schoolId={member.schoolId} /> : <EventosTab schoolId={member.schoolId} data={await getDirectorDashboard(member.schoolId)} />}
    </ShellTrabalho>
  );
}
