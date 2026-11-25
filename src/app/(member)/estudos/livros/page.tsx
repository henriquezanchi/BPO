import { CabecalhoAluno } from "@/components/member/cabecalho-aluno";
import { LivrosCliente } from "@/components/estudos/livros-cliente";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookOpen } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Meus livros (2026-10-29), na Área de Estudos. Só a própria pessoa vê. */
export default async function LivrosPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/estudos/livros");
  const livros = await db.livroLeitura.findMany({ where: { memberId: member.id }, orderBy: { updatedAt: "desc" }, select: { id: true, titulo: true, autor: true, situacao: true } });
  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <CabecalhoAluno icone={<BookOpen />} titulo="Meus livros" descricao="Lendo, quero ler, tenho e lidos. Só você vê esta lista." />
      <LivrosCliente livros={livros} />
    </main>
  );
}
