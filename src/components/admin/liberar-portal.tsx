"use client";

import { Loader2, Lock, Search, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { buscarParaLiberar, liberarNoPortal, retirarLiberacao, type PessoaParaLiberar } from "@/lib/actions/portal-liberacao-actions";

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

/**
 * Filial fechada (07/11/2026): a direção escolhe quem pode entrar no Portal. Dirigentes entram sempre; quem já entrou
 * continua entrando mesmo se a liberação for retirada (isto só vale para o primeiro acesso).
 */
export function LiberarPortal({ schoolId, liberados }: { schoolId: string; liberados: { matricula: string; nome: string; noPortal: boolean }[] }) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<PessoaParaLiberar[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const executar = (fn: () => Promise<unknown>) =>
    iniciar(async () => {
      setErro(null);
      try {
        await fn();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não deu certo. Tente de novo.");
      }
    });

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
          <Lock size={15} /> Quem pode entrar no Portal
        </h2>
        <p className="mt-1 text-[12px] text-gray-600 dark:text-gray-400">
          O Portal ainda não está aberto para todos os alunos desta filial. Dirigentes entram sempre; os demais, só quem você liberar aqui. A pessoa entra
          com o login da Nova Acrópole, usando o e-mail do cadastro da escola.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          executar(async () => setAchados(await buscarParaLiberar(schoolId, termo)));
        }}
      >
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome ou matrícula"
          aria-label="Buscar aluno ativo da filial por nome ou matrícula"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
        <button type="submit" disabled={pendente || termo.trim().length < 3} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-na-green-dark px-3 text-sm font-semibold text-white disabled:opacity-60">
          {pendente ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
        </button>
      </form>
      {erro && <p className="text-[12px] text-red-600">{erro}</p>}

      {achados && (
        <ul className="flex flex-col gap-1 text-[13px]">
          {!achados.length && <li className="text-gray-500">Nenhum ativo da filial com esse nome ou matrícula.</li>}
          {achados.map((p) => (
            <li key={p.matricula} className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-1.5 dark:border-gray-800">
              <span>
                {titulo(p.nome)} <span className="text-gray-500">· {p.matricula} · {p.nivel}</span>
              </span>
              {p.noPortal ? (
                <span className="text-[12px] text-gray-500">Já está no Portal</span>
              ) : p.liberado ? (
                <span className="text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">Liberado</span>
              ) : (
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() =>
                    executar(async () => {
                      await liberarNoPortal(schoolId, p.matricula);
                      setAchados((lista) => lista?.map((x) => (x.matricula === p.matricula ? { ...x, liberado: true } : x)) ?? null);
                    })
                  }
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-gray-300 px-2 text-[12px] font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  <UserPlus size={13} /> Liberar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">Liberados ({liberados.length})</h3>
        {liberados.length ? (
          <ul className="mt-1 flex flex-col gap-1 text-[13px]">
            {liberados.map((l) => (
              <li key={l.matricula} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {titulo(l.nome)} <span className="text-gray-500">· {l.matricula}</span>
                  {l.noPortal && <span className="text-[12px] text-gray-500"> · já entrou</span>}
                </span>
                {!l.noPortal && (
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => executar(() => retirarLiberacao(schoolId, l.matricula))}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <X size={13} /> Retirar
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[12px] text-gray-500">Ninguém liberado ainda.</p>
        )}
      </div>
    </section>
  );
}
