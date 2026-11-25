import { CabecalhoAluno } from "@/components/member/cabecalho-aluno";
import { DiarioFvDoGrupo } from "@/components/fv/diario-fv-servidor";
import { getAuthenticatedMember } from "@/lib/auth";
import { temDiario } from "@/lib/diario-dados";
import { temDiarioFv } from "@/lib/fv/dados";
import { BookHeart, Mountain } from "lucide-react";
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
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-2xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <CabecalhoAluno icone={<Mountain />} titulo="Meu diário de FV" descricao="Só você vê o que está aqui." acoes={comum ? (
          <Link href="/diario" className="flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-[12px] font-semibold text-gray-700 hover:border-na-green dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <BookHeart size={14} /> Meu diário
          </Link>
        ) : undefined} />
      <DiarioFvDoGrupo member={member} dia={dia} />
    </main>
  );
}
