import { AvaliacaoForm } from "@/components/avaliacao/avaliacao-form";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { avaliacaoPendente, instrutoresDoAluno } from "@/lib/avaliacao";
import { lerPerguntas } from "@/lib/avaliacao-comum";
import { db } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Avaliação dos instrutores — só existe enquanto houver rodada aberta com algo pendente pra este aluno. Cada rodada tem
 * o próprio link (?rodada=<id>, 10/11/2026); sem ele, ou se o aluno já respondeu aquela, abre a próxima pendente.
 */
export default async function AvaliacaoPage(props: { searchParams: Promise<{ rodada?: string }> }) {
  const { rodada } = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(rodada ? `/avaliacao?rodada=${rodada}` : "/avaliacao")}`);
  const pendente = (rodada ? await avaliacaoPendente(member, rodada) : null) ?? (await avaliacaoPendente(member));
  if (!pendente) redirect("/portal");

  const campanha = await db.avaliacaoCampanha.findUniqueOrThrow({ where: { id: pendente.campanhaId } });
  const perguntas = lerPerguntas(campanha.perguntas);
  const feitos = new Set((await db.avaliacaoParticipacao.findMany({ where: { campanhaId: campanha.id, memberId: member.id }, select: { alvo: true } })).map((p) => p.alvo));
  const instrutores = (await instrutoresDoAluno(member, campanha)).filter((i) => !feitos.has(i.alvo));

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <AvaliacaoForm
        campanhaId={campanha.id}
        titulo={campanha.titulo}
        introducao={campanha.introducao}
        perguntas={perguntas}
        instrutores={instrutores.map((i) => ({ alvo: i.alvo, instrutorNome: i.instrutorNome, turmaNome: i.turmaNome, materias: i.materias }))}
        geralPendente={!feitos.has("geral")}
      />
    </main>
  );
}
