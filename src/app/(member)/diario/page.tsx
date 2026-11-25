import { CabecalhoAluno } from "@/components/member/cabecalho-aluno";
import { DiarioCliente } from "@/components/diario/diario-cliente";
import { getAuthenticatedMember } from "@/lib/auth";
import { carregarDiario, temDiario } from "@/lib/diario-dados";
import { temDiarioFv } from "@/lib/fv/dados";
import { BookHeart, History, Mountain } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Meu diário (2026-10-29): o Diário Filosófico dentro do Portal, aberto pelo quadro do GAF. Só a própria pessoa vê. */
export default async function DiarioPage(props: { searchParams: Promise<{ dia?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/diario");
  // O diário é do GAF (pedido do usuário 2026-10-29); depois do primeiro registro, fica mesmo fora do grupo (2026-10-31).
  const [pode, fv] = await Promise.all([temDiario(member), temDiarioFv(member)]);
  if (!pode) redirect(fv ? "/diario/fv" : "/portal");
  const { dia } = await props.searchParams;
  const dados = await carregarDiario(member, dia);
  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      {/* Continua a abertura das portas (entrada-diario.tsx): a luz dourada se desfaz ao chegar. */}
      <div aria-hidden className="diario-animado pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_50%_45%,rgb(255_202_0/0.35),#020d0b_70%)] [animation:diario-chegada_700ms_ease-out_forwards]" />
      <CabecalhoAluno icone={<BookHeart />} titulo="Meu diário" descricao="Um lugar onde só a sua consciência entra." acoes={<>{fv && (
            <Link href="/diario/fv" className="flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-[12px] font-semibold text-gray-700 hover:border-na-green dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <Mountain size={14} /> FV
            </Link>
          )}
          <Link href="/diario/historico" className="flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-[12px] font-semibold text-gray-700 hover:border-na-green dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <History size={14} /> Histórico
          </Link></>} />
      <DiarioCliente d={dados} />
    </main>
  );
}
