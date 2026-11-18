import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { AbasArea } from "@/components/trabalho/areas";
import { AntecedentesPanel } from "@/components/member/volunteer/antecedentes-panel";
import { MerlinJanosPanel } from "@/components/member/volunteer/merlin-janos-panel";
import { ResponsaveisPanel } from "@/components/member/volunteer/responsaveis-panel";
import { escolasDaDirecao, estaLiberado, listarAntecedentes, temSenha } from "@/lib/antecedentes";
import { getAuthenticatedMember } from "@/lib/auth";
import { acessoInfantojuvenil, listarInfantojuvenil, sugestoesInfantojuvenil } from "@/lib/infantojuvenil";
import { PROGRAMAS, acessoVazio } from "@/lib/infantojuvenil-comum";
import { listarCriancas } from "@/lib/responsaveis";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Merlin e Janos (09/11/2026; abas novas em 18/11/2026). Só a direção da filial, os secretários do programa e a
 * administração nacional entram (lib/infantojuvenil.ts); os demais voltam para a Área do Voluntário sem saber que a
 * página existe.
 *  - Voluntários: quem atua nos programas e a certidão negativa criminal (ECA).
 *  - Responsáveis: vínculo criança ↔ responsável (lib/responsaveis.ts).
 *  - Antecedentes (Maat): só a direção, com senha exclusiva (lib/antecedentes.ts).
 */
export default async function MerlinJanosPage(props: { searchParams: Promise<{ aba?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/merlin-janos");
  const acesso = await acessoInfantojuvenil(member);
  if (acessoVazio(acesso)) redirect("/voluntario");
  const escolasDirecao = await escolasDaDirecao(member);
  const ehDirecao = escolasDirecao === null || escolasDirecao.length > 0;
  const { aba: abaPedida = "voluntarios" } = await props.searchParams;
  const aba = abaPedida === "antecedentes" && !ehDirecao ? "voluntarios" : abaPedida;
  const abas = [
    ["voluntarios", "Voluntários"],
    ["responsaveis", "Responsáveis das crianças"],
    ...(ehDirecao ? [["antecedentes", "Antecedentes (Maat)"] as const] : []),
  ] as const;

  let conteudo: React.ReactNode;
  if (aba === "responsaveis") {
    conteudo = <ResponsaveisPanel criancas={await listarCriancas(acesso)} />;
  } else if (aba === "antecedentes") {
    const senha = await temSenha(member.id);
    const lista = senha && (await estaLiberado(member.id)) ? await listarAntecedentes(member) : null;
    conteudo = <AntecedentesPanel temSenha={senha} lista={lista} />;
  } else {
    const [registros, sugestoes] = await Promise.all([listarInfantojuvenil(acesso), sugestoesInfantojuvenil(acesso)]);
    const programas = PROGRAMAS.filter((p) => acesso.todas.includes(p) || Object.values(acesso.porEscola).some((ps) => ps.includes(p)));
    const variasFiliais = acesso.todas.length > 0 || Object.keys(acesso.porEscola).length > 1;
    conteudo = (
      <>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Voluntários dos programas e a certidão negativa criminal, exigida pelo ECA e renovada a cada 6 meses. Esta lista é reservada: só a direção da
          filial, os secretários do programa e a direção nacional a veem. Guarde aqui apenas a data e o tribunal da certidão, nunca o documento.
        </p>
        <MerlinJanosPanel registros={registros} sugestoes={sugestoes} programas={programas} variasFiliais={variasFiliais} />
      </>
    );
  }

  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Merlin e Janos</h1>
      <AbasArea base="/voluntario/merlin-janos" atual={aba} abas={abas} />
      <div className="grid max-w-3xl gap-3">{conteudo}</div>
    </ShellTrabalho>
  );
}
