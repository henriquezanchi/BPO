import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { EscolasticaPanel } from "@/components/escolastica/escolastica-panel";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Área do Secretário de Escolástica — isSecretarioEscolastica vem da
 * sincronização real de "Diretor > Colaboradores" do Mercúrio (ver
 * scripts/sync-diretoria.ts). Direção também entra (requireEscolasticaOuDirecao
 * cobre os dois) porque nem toda filial já tem esse cargo preenchido lá.
 */
export default async function EscolasticaPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/escolastica");
  if (!member.isSecretarioEscolastica && !member.isDiretor && !member.isSubChefe) redirect("/portal");

  return (
    <ShellTrabalho largura="estreita">
      <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Escolástica</h1>
      <EscolasticaPanel schoolId={member.schoolId} />
    </ShellTrabalho>
  );
}
