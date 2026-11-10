"use client";

import { mudarStatusSugestao, responderSugestao } from "@/lib/actions/sugestoes-actions";
import type { SugestaoParaLer } from "@/lib/sugestoes";
import { CATEGORIAS, RESPOSTA_MAX, ROTULO_STATUS, categoria as acharCategoria, destinoDa, type StatusSugestao } from "@/lib/sugestoes-comum";
import { ChevronDown, Loader2, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Filtro = StatusSugestao | "todas";
const FILTROS: Filtro[] = ["nova", "em_analise", "respondida", "arquivada", "todas"];
const COR: Record<StatusSugestao, string> = {
  nova: "bg-na-gold/20 text-na-gold-dark dark:bg-amber-950/40 dark:text-amber-300",
  em_analise: "bg-na-warning-light text-na-warning-dark dark:bg-amber-950/40 dark:text-amber-300",
  respondida: "bg-na-success-light text-na-success-dark dark:bg-green-950/40 dark:text-green-300",
  arquivada: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};
const SELECT =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[12px] text-gray-800 outline-none focus:border-na-green dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
const data = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function PainelSugestoes({ sugestoes, variasFiliais }: { sugestoes: SugestaoParaLer[]; variasFiliais: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>(sugestoes.some((s) => s.status === "nova") ? "nova" : "todas");
  const [cat, setCat] = useState("");
  const [filial, setFilial] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { nova: 0, em_analise: 0, respondida: 0, arquivada: 0, todas: sugestoes.length };
    for (const s of sugestoes) c[s.status]++;
    return c;
  }, [sugestoes]);
  const categoriasPresentes = CATEGORIAS.filter((c) => sugestoes.some((s) => s.categoria === c.id));
  const filiais = [...new Set(sugestoes.map((s) => s.filial))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const lista = sugestoes.filter((s) => (filtro === "todas" || s.status === filtro) && (!cat || s.categoria === cat) && (!filial || s.filial === filial));

  if (!sugestoes.length)
    return <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhuma sugestão recebida ainda.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Situação">
        {FILTROS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            aria-pressed={filtro === f}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
              filtro === f ? "border-na-green bg-na-green text-white" : "border-gray-200 text-gray-700 hover:border-na-gold dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            {f === "todas" ? "Todas" : ROTULO_STATUS[f]} <span className="opacity-70">{contagem[f]}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {categoriasPresentes.length > 1 && (
          <select aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)} className={SELECT}>
            <option value="">Todas as categorias</option>
            {categoriasPresentes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        )}
        {variasFiliais && filiais.length > 1 && (
          <select aria-label="Filial" value={filial} onChange={(e) => setFilial(e.target.value)} className={SELECT}>
            <option value="">Todas as filiais</option>
            {filiais.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Nada nesta seleção.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((s) => (
            <li key={s.id} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <button type="button" onClick={() => setAberta(aberta === s.id ? null : s.id)} aria-expanded={aberta === s.id} className="flex w-full items-start gap-3 p-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{acharCategoria(s.categoria)?.rotulo ?? s.categoria}</span>
                    <span>{s.autor ? s.autor.nome : "Sem nome"}</span>
                    {variasFiliais && s.filial && <span>{s.filial}</span>}
                    <span>{data(s.criadaEm)}</span>
                  </span>
                  <span className={`mt-1 block text-[13px] text-gray-900 dark:text-gray-100 ${aberta === s.id ? "whitespace-pre-line" : "line-clamp-2"}`}>{s.texto}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${COR[s.status]}`}>{ROTULO_STATUS[s.status]}</span>
                <ChevronDown size={16} className={`mt-0.5 shrink-0 text-gray-400 transition ${aberta === s.id ? "rotate-180" : ""}`} />
              </button>
              {aberta === s.id && <Detalhe s={s} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Detalhe({ s }: { s: SugestaoParaLer }) {
  const router = useRouter();
  const [resposta, setResposta] = useState(s.resposta ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const agir = (f: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    startTransition(async () => {
      setErro(null);
      const r = await f();
      if (!r.ok) setErro(r.error);
      else router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 p-3 dark:border-gray-800">
      <dl className="grid grid-cols-1 gap-1 text-[11px] text-gray-600 sm:grid-cols-2 dark:text-gray-400">
        {s.autor && (
          <div>
            <dt className="inline font-semibold">Quem enviou: </dt>
            <dd className="inline">
              {s.autor.nome}
              {s.autor.matricula ? ` (matrícula ${s.autor.matricula})` : ""}
            </dd>
          </div>
        )}
        {s.aparelho && (
          <div className="flex items-start gap-1">
            <Monitor size={12} className="mt-0.5 shrink-0" />
            <span>{s.aparelho}</span>
          </div>
        )}
        <div>
          <dt className="inline font-semibold">Vai para: </dt>
          <dd className="inline">{destinoDa(s.categoria) === "portal" ? "equipe do Portal" : "direção da filial"}</dd>
        </div>
        {s.respondidaEm && (
          <div>
            <dt className="inline font-semibold">Respondida: </dt>
            <dd className="inline">
              {data(s.respondidaEm)}
              {s.respondidaPor ? ` por ${s.respondidaPor}` : ""}
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-1">
        <label htmlFor={`resp-${s.id}`} className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">
          {s.resposta ? "Resposta (pode corrigir)" : "Responder"}
        </label>
        <textarea
          id={`resp-${s.id}`}
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          rows={3}
          maxLength={RESPOSTA_MAX}
          placeholder="Quem enviou vê esta resposta no Portal e recebe um aviso no celular."
          className="w-full resize-y rounded-lg border border-gray-200 bg-white p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      {erro && (
        <p role="alert" className="text-[12px] text-na-danger-dark dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending || resposta.trim().length < 2}
          onClick={() => agir(() => responderSugestao(s.id, resposta))}
          className="inline-flex items-center gap-1.5 rounded-lg bg-na-green px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {isPending && <Loader2 size={12} className="animate-spin" />}
          Enviar resposta
        </button>
        {s.status === "nova" && (
          <button type="button" disabled={isPending} onClick={() => agir(() => mudarStatusSugestao(s.id, "em_analise"))} className="rounded-lg border border-gray-300 px-3 py-2 text-[12px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
            Marcar em análise
          </button>
        )}
        {s.status !== "arquivada" ? (
          <button type="button" disabled={isPending} onClick={() => agir(() => mudarStatusSugestao(s.id, "arquivada"))} className="rounded-lg border border-gray-300 px-3 py-2 text-[12px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
            Arquivar
          </button>
        ) : (
          <button type="button" disabled={isPending} onClick={() => agir(() => mudarStatusSugestao(s.id, "em_analise"))} className="rounded-lg border border-gray-300 px-3 py-2 text-[12px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
            Reabrir
          </button>
        )}
      </div>
    </div>
  );
}
