import { DiarioCliente } from "@/components/diario/diario-cliente";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { carregarDiario } from "@/lib/diario-dados";
import { meusGrupos } from "@/lib/grupos-dados";
import { ArrowLeft, History } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Meu diário (2026-10-29): o Diário Filosófico dentro do Portal, aberto pelo quadro do GAF. Só a própria pessoa vê. */
export default async function DiarioPage(props: { searchParams: Promise<{ dia?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/diario");
  // O diário é do GAF (pedido do usuário 2026-10-29): só para quem participa de um.
  if (!(await meusGrupos(member, ["GAF"])).length) redirect("/portal");
  const { dia } = await props.searchParams;
  const dados = await carregarDiario(member, dia);
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      {/* Continua a abertura das portas (entrada-diario.tsx): a luz dourada se desfaz ao chegar. */}
      <div aria-hidden className="diario-animado pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_50%_45%,rgb(255_202_0/0.35),#020d0b_70%)] [animation:diario-chegada_700ms_ease-out_forwards]" />
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <header className="flex items-end justify-between gap-3">
        <span>
          <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Meu diário</h1>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Um lugar onde só a sua consciência entra.</p>
        </span>
        <Link href="/diario/historico" className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 hover:border-na-green dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <History size={14} /> Histórico
        </Link>
      </header>
      <DiarioCliente d={dados} />
    </main>
  );
}
