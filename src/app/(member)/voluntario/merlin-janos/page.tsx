import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { MerlinJanosPanel } from "@/components/member/volunteer/merlin-janos-panel";
import { getAuthenticatedMember } from "@/lib/auth";
import { acessoInfantojuvenil, listarInfantojuvenil, sugestoesInfantojuvenil } from "@/lib/infantojuvenil";
import { PROGRAMAS, acessoVazio } from "@/lib/infantojuvenil-comum";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Voluntários do Merlin e do Janos e certidão negativa criminal (pedido do usuário 09/11/2026). Só a direção da
 * filial, os secretários do programa e a administração nacional entram (lib/infantojuvenil.ts); os demais voltam
 * para a Área do Voluntário sem saber que a página existe.
 */
export default async function MerlinJanosPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/merlin-janos");
  const acesso = await acessoInfantojuvenil(member);
  if (acessoVazio(acesso)) redirect("/voluntario");
  const [registros, sugestoes] = await Promise.all([listarInfantojuvenil(acesso), sugestoesInfantojuvenil(acesso)]);
  const programas = PROGRAMAS.filter((p) => acesso.todas.includes(p) || Object.values(acesso.porEscola).some((ps) => ps.includes(p)));
  const variasFiliais = acesso.todas.length > 0 || Object.keys(acesso.porEscola).length > 1;

  return (
    <ShellTrabalho>
      <div className="max-w-3xl">
        <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Merlin e Janos</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Voluntários dos programas e a certidão negativa criminal, exigida pelo ECA e renovada a cada 6 meses. Esta lista é reservada: só a direção da
          filial, os secretários do programa e a direção nacional a veem. Guarde aqui apenas a data e o tribunal da certidão, nunca o documento.
        </p>
      </div>
      <div className="max-w-3xl">
        <MerlinJanosPanel registros={registros} sugestoes={sugestoes} programas={programas} variasFiliais={variasFiliais} />
      </div>
    </ShellTrabalho>
  );
}
