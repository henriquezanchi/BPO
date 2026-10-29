import { DiarioCliente } from "@/components/diario/diario-cliente";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { carregarDiario } from "@/lib/diario-dados";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Meu diário (2026-10-29): o Diário Filosófico dentro do Portal, aberto pelo quadro do GAF. Só a própria pessoa vê. */
export default async function DiarioPage(props: { searchParams: Promise<{ dia?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/diario");
  const { dia } = await props.searchParams;
  const dados = await carregarDiario(member, dia);
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Meu diário</h1>
      <DiarioCliente d={dados} />
    </main>
  );
}
