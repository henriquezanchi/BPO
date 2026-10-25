import { PanoramaAreas } from "@/components/panorama/panorama";
import { SeletorFiliais } from "@/components/panorama/seletor-filiais";
import { VisaoFilial } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { getDirectorDashboard } from "@/lib/director-data";
import { alcancesDaPessoa, carregarPanorama, escolherAlcance, gruposPorRegiao } from "@/lib/panorama";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Visão geral (pedido do usuário 2026-10-25): a antiga Visão da filial, expandida para regionais e todas as
 * filiais, que absorveu o Painel Nacional (profissões). Índices por área; a Economia é uma das áreas, com o
 * financeiro detalhado do Portal recolhido dentro dela quando o alcance é a própria filial.
 */
export default async function VisaoGeralPage(props: { searchParams: Promise<{ alcance?: string; filiais?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/filial");
  const [{ alcances, escolas, nacional }, areas] = await Promise.all([alcancesDaPessoa(member), areasNaFilial(member, member.schoolId)]);
  const direcao = areas.includes("direcao");
  if (!nacional && !direcao && alcances.length < 2) redirect("/voluntario");

  const alcance = escolherAlcance(alcances, escolas, await props.searchParams, member.schoolId);
  const minhaFilial = direcao && alcance.escolas.length === 1 && alcance.escolas[0].id === member.schoolId;
  const [panorama, dashboard] = await Promise.all([
    carregarPanorama(alcance.escolas, alcance.chave === "todas"),
    minhaFilial ? getDirectorDashboard(member.schoolId) : Promise.resolve(null),
  ]);

  return (
    <ShellTrabalho>
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Visão geral</h1>
        </div>
        {escolas.length > 1 ? (
          <SeletorFiliais
            grupos={gruposPorRegiao(escolas)}
            selecionadas={alcance.escolas.map((e) => e.id)}
            rotulo={alcance.chave === "todas" ? `Todas as filiais (${escolas.length})` : alcance.escolas.length > 1 && !alcance.chave.includes(",") ? `${alcance.rotulo} (${alcance.escolas.length})` : alcance.rotulo}
            minha={escolas.some((e) => e.id === member.schoolId) ? member.schoolId : ""}
            base="/voluntario/filial"
          />
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">{alcance.rotulo}</p>
        )}
      </header>
      <PanoramaAreas
        p={panorama}
        alcance={alcance}
        base="/voluntario/filial"
        minhaFilial={minhaFilial}
        financeiro={dashboard ? <VisaoFilial schoolId={member.schoolId} data={dashboard} comRelatorio={false} /> : undefined}
      />
    </ShellTrabalho>
  );
}
