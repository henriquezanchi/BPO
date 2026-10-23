import { AreaSecretaria } from "@/components/secretarias-rede/area-secretaria";
import Link from "next/link";
import { getAuthenticatedMember } from "@/lib/auth";
import { escolasAberturas } from "@/lib/aberturas/permissoes";
import { redirect } from "next/navigation";
import { PainelAberturas } from "@/components/aberturas/painel-aberturas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getPainelAberturas } from "@/lib/aberturas-data";

export const dynamic = "force-dynamic";

export default async function AberturasPage(props: { searchParams: Promise<{ schoolId?: string;aba?:string }> }) {
  if((await props.searchParams).aba==='orientacoes')return <ShellTrabalho><AreaSecretaria secretaria="Abertura de Turma"/></ShellTrabalho>;
  const member=await getAuthenticatedMember();
  if(!member)redirect("/login?next=/voluntario/aberturas");
  if(!member.mercurioAtivo||!(await escolasAberturas(member)).length)redirect("/voluntario");
  const { schoolId } = await props.searchParams;
  const data = await getPainelAberturas(typeof schoolId === "string" ? schoolId : undefined);
  return (
    <ShellTrabalho>
      <Link href="/voluntario/aberturas?aba=orientacoes" className="text-sm font-semibold text-na-green-dark dark:text-emerald-400">Orientações, materiais e administradores da secretaria</Link>
      <PainelAberturas data={data} />
    </ShellTrabalho>
  );
}
