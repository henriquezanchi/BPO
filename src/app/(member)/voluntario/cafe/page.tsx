import { AreaSecretaria } from "@/components/secretarias-rede/area-secretaria";
import { AbasArea } from "@/components/trabalho/areas";
import { CafeArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { exigirArea } from "@/lib/area-trabalho";
import { getDirectorDashboard } from "@/lib/director-data";

export const dynamic = "force-dynamic";

/** Café: Caixa Fortuna (antes no Painel da Direção). */
export default async function CafePage(props:{searchParams:Promise<{aba?:string}>}) {
  // Orientações com o mesmo título e as mesmas abas (o menu da secretaria não some).
  if((await props.searchParams).aba==='orientacoes')return <ShellTrabalho><h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Café · Caixa Fortuna</h1><AbasArea base="/voluntario/cafe" atual="orientacoes" abas={[["caixa","Caixa Fortuna"],["orientacoes","Orientações e gestão"]]}/><AreaSecretaria secretaria="Café"/></ShellTrabalho>;
  const member = await exigirArea("cafe", "/voluntario/cafe");
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Café · Caixa Fortuna</h1>
      <AbasArea base="/voluntario/cafe" atual="caixa" abas={[["caixa","Caixa Fortuna"],["orientacoes","Orientações e gestão"]]}/>
      <CafeArea schoolId={member.schoolId} data={await getDirectorDashboard(member.schoolId)} />
    </ShellTrabalho>
  );
}
