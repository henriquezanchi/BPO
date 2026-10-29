"use client";

import { adicionarLivro, mudarSituacaoLivro, removerLivro } from "@/lib/actions/livros-actions";
import { ORDEM_LIVROS, SITUACOES_LIVRO, situacaoDoLivro, type SituacaoLivro } from "@/lib/livros";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Livro = { id: string; titulo: string; autor: string | null; situacao: string };
const CAMPO = "w-full rounded-xl border border-gray-300 bg-white p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

/** Meus livros (2026-10-29): lendo, quero ler, tenho e lidos. */
export function LivrosCliente({ livros }: { livros: Livro[] }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [nova, setNova] = useState<SituacaoLivro>("lendo");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) =>
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return setErro(r.error ?? "Não foi possível salvar.");
      setErro(null);
      depois?.();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do livro" maxLength={200} className={CAMPO} />
        <input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Autor (opcional)" maxLength={160} className={CAMPO} />
        <select value={nova} onChange={(e) => setNova(e.target.value as SituacaoLivro)} className={CAMPO}>
          {ORDEM_LIVROS.map((s) => (
            <option key={s} value={s}>
              {SITUACOES_LIVRO[s]}
            </option>
          ))}
        </select>
        <button
          disabled={pendente || !titulo.trim()}
          onClick={() =>
            rodar(() => adicionarLivro({ titulo, autor, situacao: nova }), () => {
              setTitulo("");
              setAutor("");
            })
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pendente ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar livro
        </button>
        {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      </section>
      {ORDEM_LIVROS.map((s) => {
        const grupo = livros.filter((l) => situacaoDoLivro(l.situacao) === s);
        if (!grupo.length) return null;
        return (
          <section key={s} className="flex flex-col gap-1.5">
            <h2 className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              {SITUACOES_LIVRO[s]} ({grupo.length})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {grupo.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{l.titulo}</span>
                    {l.autor && <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{l.autor}</span>}
                  </span>
                  <select
                    aria-label={`Situação de ${l.titulo}`}
                    value={situacaoDoLivro(l.situacao)}
                    disabled={pendente}
                    onChange={(e) => rodar(() => mudarSituacaoLivro(l.id, e.target.value))}
                    className="rounded-lg border border-gray-300 bg-white px-1.5 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800"
                  >
                    {ORDEM_LIVROS.map((x) => (
                      <option key={x} value={x}>
                        {SITUACOES_LIVRO[x]}
                      </option>
                    ))}
                  </select>
                  <button aria-label={`Remover ${l.titulo}`} disabled={pendente} onClick={() => confirm(`Remover "${l.titulo}"?`) && rodar(() => removerLivro(l.id))} className="text-gray-400 hover:text-na-danger-dark">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
