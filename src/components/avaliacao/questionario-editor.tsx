"use client";

import { restaurarQuestionarioBase, salvarQuestionario } from "@/lib/actions/avaliacao-actions";
import type { Pergunta, Questionario, TipoPergunta } from "@/lib/avaliacao-comum";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

const campo = "rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800";
const rotulo = "text-[11px] font-semibold text-gray-700 dark:text-gray-300";

function novaPergunta(parte: Pergunta["parte"]): Pergunta {
  return { id: `p_${Math.random().toString(36).slice(2, 9)}`, parte, secao: parte === "instrutor" ? "Avaliação dos instrutores" : "Perguntas gerais", texto: "", tipo: "texto", obrigatoria: false };
}

/** Editor do questionário da filial — Chefe, Sub-Chefe ou Secretaria de Escolástica. Rodadas já abertas não mudam. */
export function QuestionarioEditor({ schoolId, inicial }: { schoolId: string; inicial: Questionario & { personalizado: boolean } }) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [introducao, setIntroducao] = useState(inicial.introducao);
  const [perguntas, setPerguntas] = useState<Pergunta[]>(inicial.perguntas);
  const [aberto, setAberto] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const alterar = (i: number, m: Partial<Pergunta>) => setPerguntas((ps) => ps.map((p, j) => (j === i ? { ...p, ...m } : p)));
  const mover = (i: number, d: -1 | 1) =>
    setPerguntas((ps) => {
      const n = [...ps];
      const j = i + d;
      if (j < 0 || j >= n.length) return ps;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      const r = await salvarQuestionario(schoolId, { titulo, introducao, perguntas });
      setMsg(r.ok ? { ok: true, texto: "Questionário salvo. Vale para as próximas rodadas." } : { ok: false, texto: r.error });
    });
  }

  function restaurar() {
    if (!confirm("Voltar para o questionário-base nacional? As alterações da filial serão descartadas.")) return;
    startTransition(async () => {
      const r = await restaurarQuestionarioBase(schoolId);
      if (r.ok) location.reload();
      else setMsg({ ok: false, texto: r.error });
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Questionário</h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {inicial.personalizado ? "Versão da filial." : "Base nacional (formulário de Lago Norte)."} {perguntas.length} perguntas.
          </p>
        </div>
        <button onClick={() => setAberto((v) => !v)} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          {aberto ? "Fechar" : "Ver e editar"}
        </button>
      </div>

      {aberto && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className={rotulo}>Título padrão</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={rotulo}>Texto de abertura</label>
            <textarea value={introducao} onChange={(e) => setIntroducao(e.target.value)} rows={5} className={campo} />
          </div>

          {(["instrutor", "geral"] as const).map((parte) => (
            <div key={parte} className="flex flex-col gap-2">
              <h3 className="text-[12px] font-bold text-gray-900 dark:text-gray-100">
                {parte === "instrutor" ? "Perguntas sobre cada instrutor (repetidas para cada um)" : "Perguntas gerais (uma vez por aluno)"}
              </h3>
              {perguntas.map((p, i) =>
                p.parte !== parte ? null : (
                  <div key={p.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-start gap-2">
                      <textarea value={p.texto} onChange={(e) => alterar(i, { texto: e.target.value })} rows={2} placeholder="Texto da pergunta" className={`${campo} flex-1`} />
                      <div className="flex flex-col gap-1">
                        <button type="button" aria-label="Subir" onClick={() => mover(i, -1)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" aria-label="Descer" onClick={() => mover(i, 1)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                          <ArrowDown size={14} />
                        </button>
                        <button type="button" aria-label="Excluir" onClick={() => setPerguntas((ps) => ps.filter((_, j) => j !== i))} className="text-gray-400 hover:text-na-danger-dark">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className={rotulo}>Seção</label>
                        <input value={p.secao} onChange={(e) => alterar(i, { secao: e.target.value })} className={campo} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={rotulo}>Tipo</label>
                        <select
                          value={p.tipo}
                          onChange={(e) => {
                            const tipo = e.target.value as TipoPergunta;
                            alterar(i, tipo === "escala" ? { tipo, min: p.min ?? 0, max: p.max ?? 10 } : tipo === "escolha" ? { tipo, opcoes: p.opcoes?.length ? p.opcoes : ["Sim", "Não"] } : { tipo });
                          }}
                          className={campo}
                        >
                          <option value="texto">Texto livre</option>
                          <option value="escala">Escala (nota)</option>
                          <option value="escolha">Escolha única</option>
                        </select>
                      </div>
                    </div>
                    {p.tipo === "escala" && (
                      <div className="grid grid-cols-4 gap-2">
                        <input type="number" value={p.min ?? 0} onChange={(e) => alterar(i, { min: Number(e.target.value) })} aria-label="Mínimo" className={campo} />
                        <input type="number" value={p.max ?? 10} onChange={(e) => alterar(i, { max: Number(e.target.value) })} aria-label="Máximo" className={campo} />
                        <input value={p.rotuloMin ?? ""} onChange={(e) => alterar(i, { rotuloMin: e.target.value })} placeholder="Rótulo mín." className={campo} />
                        <input value={p.rotuloMax ?? ""} onChange={(e) => alterar(i, { rotuloMax: e.target.value })} placeholder="Rótulo máx." className={campo} />
                      </div>
                    )}
                    {p.tipo === "escolha" && (
                      <div className="flex flex-col gap-1">
                        <label className={rotulo}>Opções (uma por linha)</label>
                        <textarea value={(p.opcoes ?? []).join("\n")} onChange={(e) => alterar(i, { opcoes: e.target.value.split("\n") })} rows={3} className={campo} />
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={p.obrigatoria} onChange={(e) => alterar(i, { obrigatoria: e.target.checked })} className="h-4 w-4 accent-na-green" /> Obrigatória
                    </label>
                  </div>
                ),
              )}
              <button
                type="button"
                onClick={() => setPerguntas((ps) => [...ps, novaPergunta(parte)])}
                className="flex w-fit items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Plus size={12} /> Incluir pergunta
              </button>
            </div>
          ))}

          {msg && <p className={`text-[12px] ${msg.ok ? "text-na-success-dark dark:text-emerald-300" : "text-na-danger-dark dark:text-red-300"}`}>{msg.texto}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={salvar} disabled={isPending} className="flex items-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {isPending && <Loader2 size={14} className="animate-spin" />} Salvar questionário
            </button>
            {inicial.personalizado && (
              <button onClick={restaurar} disabled={isPending} className="px-3 text-[12px] font-semibold text-gray-500 underline dark:text-gray-400">
                Voltar à base nacional
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
