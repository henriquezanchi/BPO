import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { AcessosVoluntarioPanel } from "@/components/member/volunteer/acessos-voluntario-panel";
import { candidatosParaLiberar, ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Liberação em camadas da área de voluntários (ver acesso-voluntario.ts):
 * Chefe de Filial vê a filial inteira; responsável por grupo vê só os
 * integrantes dos seus grupos. Cada ação é reconferida no servidor.
 */
export default async function AcessosVoluntarioPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/acessos");
  if (!(await temAcessoVoluntario(member))) redirect("/voluntario");

  const pessoas = await candidatosParaLiberar(member);
  const nacional = await ehAdministradorNacional(member);
  const chefeDeFilial = member.isDiretor || member.filiaisChefiadas.length > 0 || nacional;
  if (!chefeDeFilial && pessoas.length === 0) redirect("/voluntario");

  return (
    <ShellTrabalho largura="estreita">
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Liberar acessos</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          A área de voluntários (grupos, avisos e canais) fica oculta até alguém liberar.{" "}
          {chefeDeFilial
            ? nacional
              ? "Como administração nacional, você libera qualquer pessoa de qualquer filial — comece pelos chefes de filial, chefes de grupo, sub-chefes e secretários."
              : "Como Chefe de Filial, você libera qualquer pessoa da filial — comece pelos chefes de grupo, sub-chefes e secretários; eles liberam os integrantes dos seus grupos."
            : "Você pode liberar os integrantes dos grupos pelos quais é responsável."}
        </p>
      </div>
      <AcessosVoluntarioPanel pessoas={pessoas} mostrarSugeridos={chefeDeFilial} />
    </ShellTrabalho>
  );
}
