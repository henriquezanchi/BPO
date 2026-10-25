import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { AbasArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { CampanhasPanel } from "@/components/avaliacao/campanhas-panel";
import { QuestionarioEditor } from "@/components/avaliacao/questionario-editor";
import { getAuthenticatedMember } from "@/lib/auth";
import { ABAS_ESCOLASTICA } from "@/lib/abas-escolastica";
import { escolasQueGereAvaliacao, questionarioDaFilial } from "@/lib/avaliacao";
import { db } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Avaliação dos instrutores — módulo da Direção (Chefe/Sub-Chefe) e da
 * Secretaria de Escolástica: questionário da filial, rodadas e relatórios.
 * Sem rodada aberta, nada aparece para os alunos.
 */
export default async function GestaoAvaliacaoPage(props: { searchParams: Promise<{ filial?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/escolastica/avaliacao");
  const ids = await escolasQueGereAvaliacao(member);
  if (!ids.length) redirect("/portal");

  const escolas = await db.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const { filial } = await props.searchParams;
  const escola = escolas.find((e) => e.id === filial) ?? escolas.find((e) => e.id === member.schoolId) ?? escolas[0];

  const [questionario, campanhas, turmas, vinculos] = await Promise.all([
    questionarioDaFilial(escola.id),
    db.avaliacaoCampanha.findMany({ where: { schoolId: escola.id }, orderBy: { abertaEm: "desc" } }),
    db.classGroup.findMany({
      where: { schoolId: escola.id, tipo: "turma", memberships: { some: { role: "aluno" } } },
      select: { id: true, name: true, _count: { select: { memberships: { where: { role: "aluno" } } } } },
      orderBy: { name: "asc" },
    }),
    db.turmaMateria.findMany({ where: { schoolId: escola.id }, select: { classGroupId: true, instrutorMatr: true } }),
  ]);
  const respostasPorCampanha = new Map(
    (await db.avaliacaoResposta.groupBy({ by: ["campanhaId"], where: { schoolId: escola.id }, _count: { _all: true } })).map((r) => [r.campanhaId, r._count._all]),
  );
  const participantesPorCampanha = new Map(
    (
      await db.avaliacaoParticipacao.groupBy({ by: ["campanhaId", "memberId"], where: { campanhaId: { in: campanhas.map((c) => c.id) } } })
    ).reduce((m, p) => m.set(p.campanhaId, (m.get(p.campanhaId) ?? 0) + 1), new Map<string, number>()),
  );
  const instrutoresPorTurma = vinculos.reduce((m, v) => m.set(v.classGroupId, new Set([...(m.get(v.classGroupId) ?? []), v.instrutorMatr])), new Map<string, Set<string>>());

  return (
    <ShellTrabalho largura="estreita">
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Escolástica</h1>
      <AbasArea base="/escolastica" atual="avaliacao" abas={ABAS_ESCOLASTICA} />
      <div className="max-w-2xl">
        <CollapsibleSection title={<h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Avaliação dos instrutores</h2>}>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Os alunos só veem a avaliação enquanto houver uma rodada aberta. Cada aluno avalia os instrutores da própria turma, segundo o Mercúrio. As respostas não guardam quem respondeu.
        </p>
      </CollapsibleSection></div>
      {escolas.length > 1 && (
        <nav className="-mt-4 flex flex-wrap gap-1.5">
          {escolas.map((e) => (
            <Link
              key={e.id}
              href={`/escolastica/avaliacao?filial=${e.id}`}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                e.id === escola.id ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              {e.name.replace(/^Nova Acrópole\s*-\s*/i, "")}
            </Link>
          ))}
        </nav>
      )}

      <CampanhasPanel
        key={`c-${escola.id}`}
        schoolId={escola.id}
        tituloPadrao={questionario.titulo}
        turmas={turmas.map((t) => ({ id: t.id, nome: t.name, alunos: t._count.memberships, instrutores: instrutoresPorTurma.get(t.id)?.size ?? 0 }))}
        campanhas={campanhas.map((c) => ({
          id: c.id,
          titulo: c.titulo,
          status: c.status,
          abertaEm: c.abertaEm,
          encerradaEm: c.encerradaEm,
          turmas: c.turmas.length,
          respostas: respostasPorCampanha.get(c.id) ?? 0,
          participantes: participantesPorCampanha.get(c.id) ?? 0,
        }))}
      />

      <QuestionarioEditor key={`q-${escola.id}`} schoolId={escola.id} inicial={questionario} />
    </ShellTrabalho>
  );
}
