import type { RelatorioCampanha } from "@/lib/avaliacao";
import type { Pergunta } from "@/lib/avaliacao-comum";

/** Resumo de uma pergunta da avaliação (média, distribuição, escolhas ou textos). Usado pela direção e pelo instrutor. */
type Bloco = RelatorioCampanha["instrutor"];

export function ResumoPergunta({ p, r }: { p: Pergunta; r: Bloco["perguntas"][number]["resumo"] }) {
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
