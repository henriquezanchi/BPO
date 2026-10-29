"use client";

import { conferirAnotacao } from "@/lib/actions/anotacoes-actions";
import { Check, EyeOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Anotacao = { id: string; aluno: string; materiaNome: string | null; materiaSigla: string; tema: string; texto: string; resumo: string | null; revisao: string };

/**
 * Anotações que os alunos compartilharam (2026-10-29). O professor marca correta ou incorreta em segredo: o aluno não
 * fica sabendo; só as corretas aparecem para os colegas do tema; as incorretas nunca aparecem.
 */
export function ConferirAnotacoes({ anotacoes }: { anotacoes: Anotacao[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const marcar = (id: string, v: "correta" | "incorreta" | "pendente") =>
    iniciar(async () => {
      const r = await conferirAnotacao(id, v);
      setErro(r.ok ? null : r.error);
      if (r.ok) router.refresh();
    });
  const pendentes = anotacoes.filter((a) => a.revisao === "pendente").length;

  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <EyeOff size={12} /> O aluno não vê a sua conferência. Só as corretas aparecem para os colegas que estudam o tema. {pendentes ? `${pendentes} para conferir.` : ""}
      </p>
      <ul className="flex flex-col gap-2">
        {anotacoes.map((a) => (
          <li key={a.id} className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <details>
              <summary className="cursor-pointer p-3">
                <span className="font-semibold">{a.tema}</span>
                <span className="text-gray-500 dark:text-gray-400"> · {a.materiaNome ?? a.materiaSigla} · {a.aluno}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.revisao === "correta" ? "bg-na-success-light text-na-success-dark" : a.revisao === "incorreta" ? "bg-na-danger-light text-na-danger-dark" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}>
                  {a.revisao === "correta" ? "Correta" : a.revisao === "incorreta" ? "Incorreta" : "A conferir"}
                </span>
              </summary>
              <div className="flex flex-col gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
                <p className="whitespace-pre-line">{a.texto}</p>
                {a.resumo && (
                  <p className="rounded-lg bg-white p-2 whitespace-pre-line dark:bg-gray-900">
                    <strong>Resumo (IA): </strong>
                    {a.resumo}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button disabled={pendente || a.revisao === "correta"} onClick={() => marcar(a.id, "correta")} className="inline-flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 font-semibold text-white disabled:opacity-50">
                    <Check size={12} /> Correta
                  </button>
                  <button disabled={pendente || a.revisao === "incorreta"} onClick={() => marcar(a.id, "incorreta")} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 font-semibold text-red-700 disabled:opacity-50 dark:text-red-300">
                    <X size={12} /> Incorreta
                  </button>
                  {a.revisao !== "pendente" && (
                    <button disabled={pendente} onClick={() => marcar(a.id, "pendente")} className="px-2 py-1.5 text-gray-500 dark:text-gray-400">
                      Desfazer
                    </button>
                  )}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {erro && <p className="text-na-danger-dark dark:text-red-300">{erro}</p>}
    </div>
  );
}
