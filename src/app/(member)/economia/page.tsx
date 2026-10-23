import { AreaSecretaria } from "@/components/secretarias-rede/area-secretaria";
import { ContasConciliacoesTab } from "@/components/director/contas-conciliacoes-tab";
import { RecuperacaoTab } from "@/components/director/recuperacao-tab";
import { EconomiaPanel } from "@/components/economia/economia-panel";
import { PaymentReviewPanel } from "@/components/economia/payment-review-panel";
import { AbasArea, SituacaoContribuicao } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { exigirArea } from "@/lib/area-trabalho";
import { getDirectorDashboard } from "@/lib/director-data";

export const dynamic = "force-dynamic";

/**
 * Economia: situação da contribuição de cada membro (em dia, sem desconto,
 * em atraso), recuperação de crédito, contas e conciliações, composição da
 * contribuição e tesouraria. Entra o Secretário de Economia (Mercúrio), o
 * responsável pela secretaria no Portal e a direção (areas-filial.ts).
 */
export default async function EconomiaPage(props: { searchParams: Promise<{ aba?: string; status?: string }> }) {
  if((await props.searchParams).aba==='orientacoes')return <ShellTrabalho><AreaSecretaria secretaria="Economia"/></ShellTrabalho>;
  const member = await exigirArea("economia", "/economia");
  const { aba = "situacao", status } = await props.searchParams;
  const data = aba === "composicao" ? null : await getDirectorDashboard(member.schoolId);
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Economia</h1>
      <AbasArea
        base="/economia"
        atual={aba}
        abas={[
          ["orientacoes", "Orientações e gestão"],
          ["situacao", "Situação da contribuição"],
          ["recuperacao", "Recuperação de crédito"],
          ["contas", "Contas e conciliações"],
          ["composicao", "Composição e tesouraria"],
        ]}
      />
      {aba === "situacao" && data && <SituacaoContribuicao schoolId={member.schoolId} data={data} status={status} />}
      {aba === "recuperacao" && data && <RecuperacaoTab schoolId={member.schoolId} data={data} />}
      {aba === "contas" && data && <ContasConciliacoesTab schoolId={member.schoolId} data={data} />}
      {aba === "composicao" && (
        <div className="flex max-w-3xl flex-col gap-6">
          <PaymentReviewPanel schoolId={member.schoolId} />
          <EconomiaPanel schoolId={member.schoolId} />
        </div>
      )}
    </ShellTrabalho>
  );
}
