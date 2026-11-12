import { CronogramaSpread } from "@/components/admin/cronograma-spread";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { lerCronograma } from "@/lib/cronograma-spread";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Cronograma da cobrança com spread (12/11/2026). Só o dono do sistema: tem condições comerciais. Ver lib/cronograma-spread.ts. */
export default async function CronogramaPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/admin/cronograma");
  if (!ehDonoDoSistema(member)) redirect("/portal");
  const acoes = await lerCronograma();
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Cronograma do spread</h1>
      <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-400">
        Cobrança pelo Portal com split no Asaas: Goiânia e região, escolas de Goiás escolhidas, Barra do Garças e Sede Nacional (Brasília). Vencimento todo
        dia 10; primeiro débito automático geral em 10/01/2027.
      </p>
      <CronogramaSpread acoes={acoes} hoje={hoje} />
    </ShellTrabalho>
  );
}
