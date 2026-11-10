import { ArrowLeft, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaixaSugestoes } from "@/components/member/caixa-sugestoes";
import { getAuthenticatedMember } from "@/lib/auth";
import { minhasSugestoes } from "@/lib/sugestoes";
import { ehCategoria } from "@/lib/sugestoes-comum";

export const dynamic = "force-dynamic";

/** Caixa de sugestões do aluno (pedido do usuário 10/11/2026): enviar, por categoria, e acompanhar as respostas. */
export default async function SugestoesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/portal/sugestoes");
  const sp = await props.searchParams;
  const inicial = ehCategoria(sp.categoria) ? sp.categoria : null;
  const minhas = await minhasSugestoes(member.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Portal do Aluno
      </Link>
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-na-green-dark dark:text-emerald-400">
          <MessageSquareText size={22} /> Sugestões
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Uma ideia, um elogio ou algo que não está funcionando. O que for sobre o Portal vai para a equipe que cuida do sistema; o que for sobre a escola, para a
          direção da sua filial.
        </p>
      </header>
      <CaixaSugestoes inicial={inicial} minhas={minhas} />
    </main>
  );
}
