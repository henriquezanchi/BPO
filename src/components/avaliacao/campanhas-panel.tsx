"use client";

import { abrirCampanha, alterarStatusCampanha } from "@/lib/actions/avaliacao-actions";
import { BarChart3, Loader2, Play, Square } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

interface Turma {
  id: string;
  nome: string;
  alunos: number;
  instrutores: number;
}

interface Campanha {
  id: string;
  titulo: string;
  status: string;
  abertaEm: Date;
  encerradaEm: Date | null;
  turmas: number;
  respostas: number;
  participantes: number;
}

const data = (d: Date) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function CampanhasPanel({ schoolId, tituloPadrao, turmas, campanhas }: { schoolId: string; tituloPadrao: string; turmas: Turma[]; campanhas: Campanha[] }) {
  const [abrindo, setAbrindo] = useState(false);
  const [titulo, setTitulo] = useState(tituloPadrao);
  const [todas, setTodas] = useState(true);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const semVinculo = turmas.filter((t) => t.instrutores === 0);

  function abrir(e: React.FormEvent) {
    e.preventDefault();
    if (!todas && escolhidas.size === 0) return setErro("Escolha pelo menos uma turma.");
    setErro(null);
    setEmAndamento("abrir");
    startTransition(async () => {
      const r = await abrirCampanha(schoolId, { titulo, turmas: todas ? [] : [...escolhidas] });
      setEmAndamento(null);
      if (r.ok) setAbrindo(false);
      else setErro(r.error);
    });
  }

  function alterar(id: string, status: "aberta" | "encerrada") {
    setEmAndamento(id);
    startTransition(async () => {
      const r = await alterarStatusCampanha(id, status);
      setEmAndamento(null);
      if (!r.ok) setErro(r.error);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Rodadas</h2>

      {abrindo ? (
        <form onSubmit={abrir} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Título que o aluno vê</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Avaliação geral — novembro/2026" className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Para quem</span>
            <label className="flex items-center gap-2 text-[13px] text-gray-800 dark:text-gray-200">
              <input type="radio" checked={todas} onChange={() => setTodas(true)} className="accent-na-green" /> Todas as turmas
            </label>
            <label className="flex items-center gap-2 text-[13px] text-gray-800 dark:text-gray-200">
              <input type="radio" checked={!todas} onChange={() => setTodas(false)} className="accent-na-green" /> Só algumas turmas (por ondas)
            </label>
            {!todas && (
              <ul className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                {turmas.map((t) => (
                  <li key={t.id}>
                    <label className="flex items-center justify-between gap-2 text-[12px] text-gray-800 dark:text-gray-200">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={escolhidas.has(t.id)}
                          onChange={(e) =>
                            setEscolhidas((a) => {
                              const n = new Set(a);
                              if (e.target.checked) n.add(t.id);
                              else n.delete(t.id);
                              return n;
                            })
                          }
                          className="h-4 w-4 accent-na-green"
                        />
                        {t.nome}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {t.alunos} {t.alunos === 1 ? "aluno" : "alunos"} · {t.instrutores} {t.instrutores === 1 ? "instrutor" : "instrutores"}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            As perguntas atuais do questionário (abaixo) são copiadas para esta rodada. Ao abrir, o quadrinho aparece no Portal de cada aluno com algo a responder.
          </p>
          {erro && <p className="text-[11px] text-na-danger-dark dark:text-red-300">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={emAndamento === "abrir"} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {emAndamento === "abrir" && <Loader2 size={14} className="animate-spin" />} Liberar para os alunos
            </button>
            <button type="button" onClick={() => setAbrindo(false)} className="px-3 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAbrindo(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-[13px] font-semibold text-gray-700 transition hover:border-na-green hover:text-na-green-dark dark:border-gray-700 dark:text-gray-300"
        >
          <Play size={14} /> Abrir nova rodada
        </button>
      )}

      {semVinculo.length > 0 && (
        <p className="text-[11px] text-na-warning-dark dark:text-amber-300">
          {semVinculo.length === 1 ? "A turma" : "As turmas"} {semVinculo.map((t) => t.nome).join(", ")} não {semVinculo.length === 1 ? "tem" : "têm"} instrutor vinculado no Mercúrio — esses alunos só respondem a parte geral.
        </p>
      )}

      {campanhas.length === 0 ? (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhuma rodada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campanhas.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.titulo}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {c.status === "aberta" ? `Aberta desde ${data(c.abertaEm)}` : `Encerrada em ${data(c.encerradaEm ?? c.abertaEm)}`} · {c.turmas ? `${c.turmas} turma(s)` : "todas as turmas"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    c.status === "aberta" ? "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {c.status === "aberta" ? "Aberta" : "Encerrada"}
                </span>
              </div>
              <p className="text-[12px] text-gray-700 dark:text-gray-300">
                {c.participantes} {c.participantes === 1 ? "aluno respondeu" : "alunos responderam"} · {c.respostas} {c.respostas === 1 ? "resposta" : "respostas"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/escolastica/avaliacao/${c.id}`}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <BarChart3 size={12} /> Relatórios
                </Link>
                <button
                  onClick={() => alterar(c.id, c.status === "aberta" ? "encerrada" : "aberta")}
                  disabled={emAndamento === c.id}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {c.status === "aberta" ? <Square size={11} /> : <Play size={11} />} {c.status === "aberta" ? "Encerrar" : "Reabrir"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
