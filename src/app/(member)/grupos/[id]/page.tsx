import { GrupoPainel } from "@/components/grupos/grupo-painel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { detalheDoGrupo } from "@/lib/grupos-dados";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Página de um grupo: GAF, GDVE, secretaria ou Grupo Feminino/Masculino/de Segurança. */
export default async function GrupoPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string }> }) {
  const { id } = await props.params;
  const { de } = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/grupos/${id}`);
  const dados = await detalheDoGrupo(member, id);
  if (!dados) notFound();
  const voltar = de === "admin" ? { href: "/admin", rotulo: "Administração" } : de === "portal" ? { href: "/portal", rotulo: "Portal do Aluno" } : { href: "/voluntario", rotulo: "Portal do Voluntário" };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-na-bg p-4 lg:p-8 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <Link href={voltar.href} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> {voltar.rotulo}
        </Link>
        <ThemeToggle />
      </div>
      <GrupoPainel dados={dados} />
    </main>
  );
}
