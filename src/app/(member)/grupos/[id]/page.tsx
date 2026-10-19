import { GrupoPainel } from "@/components/grupos/grupo-painel";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { destinosDaPessoa } from "@/lib/area-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { detalheDoGrupo } from "@/lib/grupos-dados";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Página de um grupo: GAF, GDVE, secretaria ou Grupo Feminino/Masculino/de
 * Segurança. Voluntários e administração veem dentro da Área do Voluntário;
 * quem só participa de um GAF (aluno) vê uma página simples, com volta ao Portal.
 */
export default async function GrupoPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string }> }) {
  const { id } = await props.params;
  const { de } = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/grupos/${id}`);
  const [dados, destinos] = await Promise.all([detalheDoGrupo(member, id), destinosDaPessoa(member)]);
  if (!dados) notFound();

  if (!destinos.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft size={14} /> Portal do Aluno
          </Link>
          <ThemeToggle />
        </div>
        <GrupoPainel dados={dados} />
      </main>
    );
  }
  return (
    <ShellTrabalho ativo={de === "admin" ? "/admin" : "/voluntario"}>
      <GrupoPainel dados={dados} />
    </ShellTrabalho>
  );
}
