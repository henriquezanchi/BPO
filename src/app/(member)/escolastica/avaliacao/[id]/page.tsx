import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { podeGerirAvaliacao, relatorioCampanha, type RelatorioCampanha } from "@/lib/avaliacao";
import { MINIMO_RESPOSTAS, type Pergunta } from "@/lib/avaliacao-comum";
import { db } from "@/lib/db";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Bloco = RelatorioCampanha["instrutor"];

function Resumo({ p, r }: { p: Pergunta; r: Bloco["perguntas"][number]["resumo"] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
      <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{p.texto}</p>
      {r.tipo === "escala" && (
        <>
          <p className="text-[12px] text-gray-600 dark:text-gray-300">
            Média <strong className="text-gray-900 dark:text-gray-100">{r.media?.toFixed(1) ?? "—"}</strong> · {r.total} {r.total === 1 ? "resposta" : "respostas"}
            {r.nps !== null && (
              <>
                {" "}
                · Índice de recomendação (NPS) <strong className="text-gray-900 dark:text-gray-100">{r.nps}</strong>
              </>
            )}
          </p>
          <div className="flex items-end gap-1" aria-label="Distribuição das notas">
            {r.distribuicao.map((d) => {
              const max = Math.max(...r.distribuicao.map((x) => x.total), 1);
              return (
                <div key={d.valor} className="flex flex-1 flex-col items-center gap-0.5">
                  <span className="text-[9px] text-gray-500 dark:text-gray-400">{d.total || ""}</span>
                  <div className="w-full rounded-t bg-na-green/70 dark:bg-emerald-500/70" style={{ height: `${(d.total / max) * 48 + 2}px` }} />
                  <span className="text-[9px] text-gray-500 dark:text-gray-400">{d.valor}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {r.tipo === "escolha" && (
        <ul className="flex flex-col gap-1">
          {r.contagem.map((c) => (
            <li key={c.opcao} className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300">
              <span className="w-40 shrink-0 truncate">{c.opcao}</span>
              <span className="h-2 rounded bg-na-green/70 dark:bg-emerald-500/70" style={{ width: `${r.total ? (c.total / r.total) * 100 : 0}%`, minWidth: c.total ? 4 : 0 }} />
              <span className="text-gray-500 dark:text-gray-400">
                {c.total} ({r.total ? Math.round((c.total / r.total) * 100) : 0}%)
              </span>
            </li>
          ))}
        </ul>
      )}
      {r.tipo === "texto" &&
        (r.textos.length ? (
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {r.textos.map((t, i) => (
              <li key={i} className="rounded-lg bg-gray-50 p-2 text-[12px] whitespace-pre-line text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Sem respostas escritas.</p>
        ))}
    </div>
  );
}

function SecaoBloco({ titulo, bloco, perguntasPorId, verIndividuais }: { titulo: string; bloco: Bloco; perguntasPorId: Map<string, Pergunta>; verIndividuais: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        {titulo} <span className="font-normal text-gray-500 dark:text-gray-400">· {bloco.total} {bloco.total === 1 ? "resposta" : "respostas"}</span>
      </h2>
      {!bloco.suficiente ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-gray-50 p-3 text-[12px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <Lock size={13} className="mt-0.5 shrink-0" /> Resultados aparecem a partir de {MINIMO_RESPOSTAS} respostas neste recorte, para ninguém ser identificado.
        </p>
      ) : verIndividuais ? (
        <ul className="flex flex-col gap-2">
          {bloco.individuais.map((r, n) => (
            <li key={r.id} className="flex flex-col gap-1.5 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                Resposta {n + 1}
                {r.instrutor ? ` · ${r.instrutor}` : ""}
                {r.turma ? ` · ${r.turma}` : ""}
              </p>
              {Object.entries(r.respostas).map(([id, v]) => (
                <p key={id} className="text-[12px] text-gray-700 dark:text-gray-300">
                  <span className="text-gray-500 dark:text-gray-400">{perguntasPorId.get(id)?.texto ?? id}: </span>
                  <span className="whitespace-pre-line">{String(v)}</span>
                </p>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        bloco.perguntas.map((x) => <Resumo key={x.pergunta.id} p={x.pergunta} r={x.resumo} />)
      )}
    </section>
  );
}

/** Relatório de uma rodada: por escola, por turma, por instrutor e por resposta (individuais anônimas). */
export default async function RelatorioAvaliacaoPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ turma?: string; instrutor?: string; ver?: string }> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/escolastica/avaliacao/${id}`);
  const campanha = await db.avaliacaoCampanha.findUnique({ where: { id }, select: { schoolId: true, perguntas: true } });
  if (!campanha || !(await podeGerirAvaliacao(member, campanha.schoolId))) redirect("/portal");

  const rel = await relatorioCampanha(id, { classGroupId: sp.turma, instrutorMatr: sp.instrutor });
  const perguntasPorId = new Map((campanha.perguntas as unknown as Pergunta[]).map((p) => [p.id, p]));
  const verIndividuais = sp.ver === "respostas";
  const link = (m: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ turma: sp.turma, instrutor: sp.instrutor, ver: sp.ver, ...m }).filter(([, v]) => v) as [string, string][]);
    return `/escolastica/avaliacao/${id}${q.size ? `?${q}` : ""}`;
  };
  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1 text-[11px] font-semibold ${ativo ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"}`;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <Link href={`/escolastica/avaliacao?filial=${rel.campanha.schoolId}`} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Avaliação dos instrutores
        </Link>
        <ThemeToggle />
      </div>
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">{rel.campanha.titulo}</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Respostas anônimas. Recortes com menos de {MINIMO_RESPOSTAS} respostas ficam ocultos.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {[
          { titulo: "Por instrutor", lista: rel.porInstrutor, param: "instrutor", atual: sp.instrutor },
          { titulo: "Por turma", lista: rel.porTurma, param: "turma", atual: sp.turma },
        ].map((g) => (
          <div key={g.titulo} className="flex flex-col gap-2 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{g.titulo}</h2>
            {g.lista.length === 0 ? (
              <p className="text-[12px] text-gray-500 dark:text-gray-400">Sem respostas ainda.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {g.lista.map((x) => (
                  <li key={x.id}>
                    <Link
                      href={link({ [g.param]: g.atual === x.id ? undefined : x.id })}
                      className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12px] ${g.atual === x.id ? "bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                    >
                      <span className="truncate">{x.rotulo}</span>
                      <span className="shrink-0 text-gray-500 dark:text-gray-400">
                        {x.media !== null ? `média ${x.media.toFixed(1)}` : "—"} · {x.total}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {rel.escalaInstrutor && <p className="text-[10px] text-gray-500 dark:text-gray-400">Média da pergunta: “{rel.escalaInstrutor}”</p>}
          </div>
        ))}
      </section>

      <nav className="flex flex-wrap items-center gap-1.5">
        <Link href={link({ ver: undefined })} className={chip(!verIndividuais)}>
          Resumo
        </Link>
        <Link href={link({ ver: "respostas" })} className={chip(verIndividuais)}>
          Respostas individuais
        </Link>
        {(sp.turma || sp.instrutor) && (
          <Link href={link({ turma: undefined, instrutor: undefined })} className="ml-1 text-[11px] font-semibold text-gray-500 underline dark:text-gray-400">
            Limpar filtro (ver escola toda)
          </Link>
        )}
      </nav>

      <SecaoBloco titulo={sp.instrutor ? "Avaliação do instrutor" : "Avaliação dos instrutores"} bloco={rel.instrutor} perguntasPorId={perguntasPorId} verIndividuais={verIndividuais} />
      {!sp.instrutor && <SecaoBloco titulo={sp.turma ? "Perguntas gerais da turma" : "Perguntas gerais da escola"} bloco={rel.geral} perguntasPorId={perguntasPorId} verIndividuais={verIndividuais} />}
    </main>
  );
}
