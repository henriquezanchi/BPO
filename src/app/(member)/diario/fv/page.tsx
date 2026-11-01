import { DiarioFvDoGrupo } from "@/components/fv/diario-fv-servidor";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { temDiario } from "@/lib/diario-dados";
import { temDiarioFv } from "@/lib/fv/dados";
import { ArrowLeft, BookHeart } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Meu diário de FV fora do GDVE (pedido do usuário 2026-10-31): o mesmo diário da aba do grupo, para quem já fez o
 * primeiro registro e saiu do GDVE (ou prefere abrir direto). Só a própria pessoa vê.
 */
export default async function DiarioFvPage(props: { searchParams: Promise<{ dia?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/diario/fv");
  const [pode, comum] = await Promise.all([temDiarioFv(member), temDiario(member)]);
  if (!pode) redirect("/portal");
  const { dia } = await props.searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <header className="flex items-end justify-between gap-3">
        <span>
          <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Meu diário de FV</h1>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Só você vê o que está aqui.</p>
        </span>
        {comum && (
          <Link href="/diario" className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 hover:border-na-green dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <BookHeart size={14} /> Meu diário
          </Link>
        )}
      </header>
      <DiarioFvDoGrupo member={member} dia={dia} />
    </main>
  );
}
