import { AreaSecretaria } from "@/components/secretarias-rede/area-secretaria";
import { ContasConciliacoesTab } from "@/components/director/contas-conciliacoes-tab";
import { RecuperacaoTab } from "@/components/director/recuperacao-tab";
import { CobrancaOnline } from "@/components/economia/cobranca-online";
import { EconomiaPanel } from "@/components/economia/economia-panel";
import { PaymentReviewPanel } from "@/components/economia/payment-review-panel";
import { AbasArea, SituacaoContribuicao } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { exigirArea } from "@/lib/area-trabalho";
import { db } from "@/lib/db";
import { getDirectorDashboard } from "@/lib/director-data";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
import Link from "next/link";

const ABAS_ECONOMIA = [
  ["orientacoes", "Orientações e gestão"],
  ["situacao", "Situação da contribuição"],
  ["recuperacao", "Recuperação de crédito"],
  ["contas", "Contas e conciliações"],
  ["composicao", "Composição e tesouraria"],
  ["cobranca", "Cobrança on-line"],
] as const;

export const dynamic = "force-dynamic";

/**
 * Economia: situação da contribuição de cada membro (em dia, sem desconto,
 * em atraso), recuperação de crédito, contas e conciliações, composição da
 * contribuição e tesouraria. Entra o Secretário de Economia (Mercúrio), o
 * responsável pela secretaria no Portal e a direção (areas-filial.ts).
 */
export default async function EconomiaPage(props: { searchParams: Promise<{ aba?: string; status?: string; filial?: string }> }) {
  // Orientações com o mesmo título e as mesmas abas (o menu da secretaria não some).
  if((await props.searchParams).aba==='orientacoes')return <ShellTrabalho><h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Economia</h1><AbasArea base="/economia" atual="orientacoes" abas={ABAS_ECONOMIA}/><AreaSecretaria secretaria="Economia"/></ShellTrabalho>;
  const member = await exigirArea("economia", "/economia");
  const { aba = "situacao", status, filial } = await props.searchParams;
  // Dono do sistema (12/11/2026): a Economia de qualquer filial, escolhida no seletor abaixo das abas.
  const dono = ehDonoDoSistema(member);
  const escolas = dono ? await db.school.findMany({ where: { mercurioUnidade: { not: null } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const schoolId = dono && filial && escolas.some((e) => e.id === filial) ? filial : member.schoolId;
  const sufixo = schoolId !== member.schoolId ? `&filial=${schoolId}` : "";
  const abas = ABAS_ECONOMIA.map(([id, rotulo]) => [id, rotulo, `/economia?aba=${id}${sufixo}`] as const);
  const data = aba === "composicao" || aba === "cobranca" ? null : await getDirectorDashboard(schoolId);
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Economia</h1>
      <AbasArea
        base="/economia"
        atual={aba}
        abas={abas}
      />
      {dono && (
        <form action="/economia" className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="aba" value={aba} />
          <label htmlFor="economia-filial" className="font-semibold text-gray-600 dark:text-gray-400">Filial</label>
          <select id="economia-filial" name="filial" defaultValue={schoolId} className="min-h-9 rounded-lg border border-gray-300 bg-white px-2 dark:border-gray-700 dark:bg-gray-900">
            {escolas.map((e) => (
              <option key={e.id} value={e.id}>{e.name.replace(/^Nova Acrópole\s*-\s*/i, "")}</option>
            ))}
          </select>
          <button type="submit" className="min-h-9 rounded-lg border border-gray-300 px-3 font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">Abrir</button>
          {schoolId !== member.schoolId && <Link href={`/economia?aba=${aba}`} className="text-na-green underline dark:text-emerald-400">Voltar à minha filial</Link>}
        </form>
      )}
      {aba === "situacao" && data && <SituacaoContribuicao schoolId={schoolId} data={data} status={status} />}
      {aba === "recuperacao" && data && <RecuperacaoTab schoolId={schoolId} data={data} />}
      {aba === "contas" && data && <ContasConciliacoesTab schoolId={schoolId} data={data} />}
      {aba === "cobranca" && <CobrancaOnline schoolId={schoolId} dono={dono} />}
      {aba === "composicao" && (
        <div className="flex max-w-3xl flex-col gap-6">
          <PaymentReviewPanel schoolId={schoolId} />
          <EconomiaPanel schoolId={schoolId} />
        </div>
      )}
    </ShellTrabalho>
  );
}
