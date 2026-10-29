import { LivrosCliente } from "@/components/estudos/livros-cliente";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Meus livros (2026-10-29), na Área de Estudos. Só a própria pessoa vê. */
export default async function LivrosPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/estudos/livros");
  const livros = await db.livroLeitura.findMany({ where: { memberId: member.id }, orderBy: { updatedAt: "desc" }, select: { id: true, titulo: true, autor: true, situacao: true } });
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Meus livros</h1>
      <LivrosCliente livros={livros} />
    </main>
  );
}
