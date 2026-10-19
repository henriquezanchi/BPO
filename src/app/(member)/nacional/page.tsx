import { PainelProfissoes } from "@/components/relatorios/painel-profissoes";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ehAdministradorNacional } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ResumoProfissoes } from "@/lib/mercurio-db/resumo-profissoes";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Painel nacional (pedido do usuário 2026-10-19): visão de toda a OINAB-N
 * para a direção nacional (Luis Carlos e a administração nacional —
 * LiberadorNacional). Começa pelas profissões e áreas de atuação.
 */
export default async function PainelNacionalPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/nacional");
  if (!(await ehAdministradorNacional(member))) redirect("/portal");
  const resumo = await db.resumoNacional.findUnique({ where: { chave: "profissoes" } });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Painel Nacional · Brasil Norte</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Todas as unidades do Mercúrio, somente pessoas ativas.</p>
      </div>
      <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Profissões e áreas de atuação</h2>
        {resumo ? (
          <PainelProfissoes dados={resumo.dados as unknown as ResumoProfissoes} nacional />
        ) : (
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Disponível depois da próxima sincronização com o Mercúrio (3h30).</p>
        )}
      </section>
    </main>
  );
}
