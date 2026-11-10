import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { PainelSugestoes } from "@/components/member/volunteer/painel-sugestoes";
import { getAuthenticatedMember } from "@/lib/auth";
import { acessoSugestoes, listarSugestoes } from "@/lib/sugestoes";
import { semAcessoSugestoes } from "@/lib/sugestoes-comum";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Sugestões recebidas (pedido do usuário 10/11/2026). A direção da filial lê as da escola; a administração nacional,
 * também as do Portal (lib/sugestoes.ts). Quem não lê nada volta para a Área do Voluntário.
 */
export default async function SugestoesRecebidasPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/sugestoes");
  const acesso = await acessoSugestoes(member);
  if (semAcessoSugestoes(acesso)) redirect("/voluntario");
  const sugestoes = await listarSugestoes(acesso);
  const variasFiliais = acesso.escolas === "todas" || acesso.escolas.length > 1;

  return (
    <ShellTrabalho>
      <div className="max-w-3xl">
        <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Sugestões</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {acesso.portal
            ? "O que alunos e membros enviaram pela caixa de sugestões: sobre o Portal e sobre as filiais."
            : "O que alunos e membros da filial enviaram pela caixa de sugestões sobre a escola."}{" "}
          Sugestões sem nome chegam sem nome e matrícula. A resposta aparece para quem enviou.
        </p>
      </div>
      <div className="max-w-3xl">
        <PainelSugestoes sugestoes={sugestoes} variasFiliais={variasFiliais} />
      </div>
    </ShellTrabalho>
  );
}
