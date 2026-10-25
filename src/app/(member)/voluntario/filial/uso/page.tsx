import { ListaUso } from "@/components/panorama/lista-uso";
import { SeletorFiliais } from "@/components/panorama/seletor-filiais";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { alcancesDaPessoa, escolherAlcance, gruposPorRegiao } from "@/lib/panorama";
import { usoDoPortal } from "@/lib/uso-portal";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Quem usa e quem não usa o Portal (pedido do usuário 2026-10-25), com o mesmo seletor de filiais da Visão geral. */
export default async function UsoDoPortalPage(props: { searchParams: Promise<{ alcance?: string; filiais?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/filial/uso");
  const [{ alcances, escolas, nacional }, areas] = await Promise.all([alcancesDaPessoa(member), areasNaFilial(member, member.schoolId)]);
  if (!nacional && !areas.includes("direcao") && alcances.length < 2) redirect("/voluntario");
  const params = await props.searchParams;
  const alcance = escolherAlcance(alcances, escolas, params, member.schoolId);
  const uso = await usoDoPortal(alcance.escolas);
  const query = params.filiais ? `?filiais=${params.filiais}` : `?alcance=${alcance.chave}`;

  return (
    <ShellTrabalho ativo="/voluntario/filial">
      <Link href={`/voluntario/filial${query}`} className="flex w-fit items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Visão geral
      </Link>
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Quem usa o Portal</h1>
        {escolas.length > 1 ? (
          <SeletorFiliais
            grupos={gruposPorRegiao(escolas)}
            selecionadas={alcance.escolas.map((e) => e.id)}
            rotulo={alcance.chave === "todas" ? `Todas as filiais (${escolas.length})` : alcance.rotulo}
            minha={escolas.some((e) => e.id === member.schoolId) ? member.schoolId : ""}
            base="/voluntario/filial/uso"
          />
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">{alcance.rotulo}</p>
        )}
      </header>
      <ListaUso usando={uso.usando} naoUsando={uso.naoUsando} ativos={uso.ativos} varias={alcance.escolas.length > 1} />
    </ShellTrabalho>
  );
}
