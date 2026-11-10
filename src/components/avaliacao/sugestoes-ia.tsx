"use client";

import { sugestoesDaAvaliacao, type SugestoesIA } from "@/lib/actions/avaliacao-ia-actions";
import { Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

/** Botão "Sugestões da IA" (actions/avaliacao-ia-actions.ts): gera na hora, não guarda. */
export function SugestoesDaIA({ campanhaId, instrutorMatr, rotulo = "Gerar sugestões com IA" }: { campanhaId: string; instrutorMatr?: string; rotulo?: string }) {
  const [dados, setDados] = useState<SugestoesIA | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const r = await sugestoesDaAvaliacao(campanhaId, instrutorMatr);
      if (r.ok) setDados(r.dados);
      else setErro(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {!dados && (
        <button
          type="button"
          onClick={gerar}
          disabled={isPending}
          className="flex w-fit items-center gap-1.5 rounded-lg border border-na-green px-3 py-2 text-[12px] font-semibold text-na-green-dark transition hover:bg-na-green-light/60 disabled:opacity-60 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {isPending ? "Lendo as respostas..." : rotulo}
        </button>
      )}
      {erro && (
        <p role="alert" className="text-[12px] text-na-danger-dark dark:text-red-300">
          {erro}
        </p>
      )}
      {dados && (
        <div className="flex flex-col gap-3 rounded-xl border border-na-green/30 bg-na-green-light/30 p-3 text-[13px] text-gray-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-gray-200">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">
            <Sparkles size={12} /> Sugestões da IA · ponto de partida, não veredito
          </p>
          {dados.temas.length > 0 && (
            <div>
              <h4 className="mb-1 text-[12px] font-bold">O que os alunos mais comentam</h4>
              <ul className="flex flex-col gap-1">
                {dados.temas.map((t, i) => (
                  <li key={i}>
                    <strong>{t.tema}</strong> <span className="text-[11px] text-gray-500 dark:text-gray-400">({t.frequencia})</span>: {t.resumo}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dados.pontosFortes.length > 0 && (
            <div>
              <h4 className="mb-1 text-[12px] font-bold">O que vai bem</h4>
              <ul className="list-disc pl-5">
                {dados.pontosFortes.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {dados.sugestoes.length > 0 && (
            <div>
              <h4 className="mb-1 text-[12px] font-bold">Sugestões para as próximas aulas</h4>
              <ul className="list-disc pl-5">
                {dados.sugestoes.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {dados.orientacao && (
            <div>
              <h4 className="mb-1 text-[12px] font-bold">Como conduzir a orientação</h4>
              <p>{dados.orientacao}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
