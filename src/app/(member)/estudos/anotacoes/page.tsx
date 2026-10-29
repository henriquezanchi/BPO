import { AnotacoesCliente } from "@/components/estudos/anotacoes-cliente";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { carregarAnotacoes } from "@/lib/anotacoes";
import { fusoDaEscola } from "@/lib/atendimentos";
import { getAuthenticatedMember } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Anotações das aulas (2026-10-29), aberto pela Área de Estudos. */
export default async function AnotacoesPage(props: { searchParams: Promise<{ materia?: string; tema?: string; tipo?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/estudos/anotacoes");
  const { materia, tema, tipo } = await props.searchParams;
  const dados = await carregarAnotacoes(member, { sigla: materia, tema, tipo });
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <header>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Anotações das aulas</h1>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Anote cada tema, resuma para a prova e compartilhe se quiser.</p>
      </header>
      <AnotacoesCliente key={`${dados.escolha?.sigla}|${dados.escolha?.tema}`} d={dados} fuso={fusoDaEscola(member.school.uf)} />
    </main>
  );
}
