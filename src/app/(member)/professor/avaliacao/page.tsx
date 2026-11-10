import { ResumoPergunta } from "@/components/avaliacao/resumo-pergunta";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { resultadosDoInstrutor } from "@/lib/avaliacao";
import { MINIMO_RESPOSTAS } from "@/lib/avaliacao-comum";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** O instrutor vê o resumo das avaliações sobre ele (lib/avaliacao.ts, resultadosDoInstrutor). */
export default async function MinhasAvaliacoesPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/professor/avaliacao");
  if (!member.isPedagogo) redirect("/voluntario");
  const rodadas = await resultadosDoInstrutor(member.mercurioId);

  return (
    <ShellTrabalho largura="estreita">
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Minhas avaliações</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          O que os alunos responderam sobre as suas aulas, somando todas as suas turmas. As respostas são anônimas: os resultados aparecem quando a rodada é
          encerrada e quando há pelo menos {MINIMO_RESPOSTAS} respostas.
        </p>
      </div>

      {rodadas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Ainda não há rodada encerrada com avaliações sobre você.
        </p>
      ) : (
        rodadas.map((r) => (
          <section key={r.campanha.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{r.campanha.titulo}</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {r.total} {r.total === 1 ? "resposta" : "respostas"}
                {r.turmas.length ? ` · ${r.turmas.join(", ")}` : ""}
                {r.campanha.encerradaEm ? ` · encerrada em ${r.campanha.encerradaEm.toLocaleDateString("pt-BR")}` : ""}
              </p>
            </div>
            {r.suficiente ? (
              r.perguntas.map((x) => <ResumoPergunta key={x.pergunta.id} p={x.pergunta} r={x.resumo} />)
            ) : (
              <p className="flex items-start gap-1.5 rounded-lg bg-gray-50 p-3 text-[12px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <Lock size={13} className="mt-0.5 shrink-0" /> Menos de {MINIMO_RESPOSTAS} respostas nesta rodada: o resultado fica oculto para ninguém ser identificado.
              </p>
            )}
          </section>
        ))
      )}
    </ShellTrabalho>
  );
}
