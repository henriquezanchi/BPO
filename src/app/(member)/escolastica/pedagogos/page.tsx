import { PedagogosAdmin } from "@/components/admin/grupos-admin";
import { AbasArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { ABAS_ESCOLASTICA } from "@/lib/abas-escolastica";
import { getAuthenticatedMember } from "@/lib/auth";
import { gruposDaFilial } from "@/lib/grupos-dados";
import { podeCriarTurmaPedagogos } from "@/lib/grupos-portal";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Turmas de pedagogos dentro da Escolástica (pedido do usuário 2026-10-29): a mesma tela de Grupos → Turmas de
 * pedagogos, para quem tem a Escolástica (ou a Direção) da própria filial. Permissão: podeCriarTurmaPedagogos.
 */
export default async function PedagogosEscolasticaPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/escolastica/pedagogos");
  if (!(await podeCriarTurmaPedagogos(member, member.schoolId))) redirect("/escolastica");
  const grupos = await gruposDaFilial(member.schoolId, "PED");
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Escolástica</h1>
      <AbasArea base="/escolastica" atual="pedagogos" abas={ABAS_ESCOLASTICA} />
      <PedagogosAdmin schoolId={member.schoolId} grupos={grupos} />
    </ShellTrabalho>
  );
}
