"use client";

import { Check, ChevronDown, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type GrupoRegional = { id: string; nome: string; estados: { uf: string; escolas: { id: string; nome: string }[] }[] };

/**
 * Escolha das filiais da Visão geral (pedido do usuário 2026-10-25): lista suspensa com as filiais por
 * regional e estado; marca uma, várias, um estado ou uma regional inteira, e aplica.
 */
export function SeletorFiliais({ grupos, selecionadas, rotulo, minha, base }: { grupos: GrupoRegional[]; selecionadas: string[]; rotulo: string; minha: string; base: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [marcadas, setMarcadas] = useState(() => new Set(selecionadas));
  const caixa = useRef<HTMLDivElement>(null);
  const todas = grupos.flatMap((g) => g.estados.flatMap((e) => e.escolas.map((x) => x.id)));

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const estado = (ids: string[]) => {
    const n = ids.filter((id) => marcadas.has(id)).length;
    return n === 0 ? "nenhuma" : n === ids.length ? "todas" : "algumas";
  };
  const alternar = (ids: string[]) => {
    const novo = new Set(marcadas);
    if (estado(ids) === "todas") ids.forEach((id) => novo.delete(id));
    else ids.forEach((id) => novo.add(id));
    setMarcadas(novo);
  };
  function aplicar() {
    if (!marcadas.size) return;
    setAberto(false);
    router.push(marcadas.size === todas.length ? `${base}?alcance=todas` : `${base}?filiais=${[...marcadas].join(",")}`);
  }

  const linhaDeEscolha = (ids: string[], texto: string, nivel: 0 | 1 | 2, chave?: string) => {
    const e = estado(ids);
    return (
      <button
        key={chave}
        type="button"
        role="checkbox"
        aria-checked={e === "todas" ? true : e === "algumas" ? "mixed" : false}
        onClick={() => alternar(ids)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${nivel === 0 ? "text-[13px] font-bold" : nivel === 1 ? "pl-6 text-[12px] font-semibold text-gray-600 dark:text-gray-300" : "pl-10 text-[13px]"}`}
      >
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${e === "nenhuma" ? "border-gray-400 dark:border-gray-500" : "border-na-green bg-na-green text-white"}`}>
          {e === "todas" ? <Check size={12} /> : e === "algumas" ? <Minus size={12} /> : null}
        </span>
        <span className="min-w-0 truncate">{texto}</span>
        {nivel < 2 && <span className="ml-auto text-[11px] font-normal text-gray-400">{ids.length}</span>}
      </button>
    );
  };

  return (
    <div ref={caixa} className="relative w-full max-w-sm">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => {
          setMarcadas(new Set(selecionadas));
          setAberto(!aberto);
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-left text-[13px] font-semibold text-gray-800 hover:border-na-green dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        <span className="min-w-0 truncate">{rotulo}</span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1.5 flex w-full flex-col rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="flex gap-1.5 border-b border-gray-100 p-2 dark:border-gray-800">
            <button type="button" onClick={() => setMarcadas(new Set(todas))} className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-na-green-dark hover:bg-na-green-light dark:text-emerald-400 dark:hover:bg-emerald-950/40">
              Todas
            </button>
            {minha && (
              <button type="button" onClick={() => setMarcadas(new Set([minha]))} className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-na-green-dark hover:bg-na-green-light dark:text-emerald-400 dark:hover:bg-emerald-950/40">
                Só a minha
              </button>
            )}
            <button type="button" onClick={() => setMarcadas(new Set())} className="ml-auto rounded-lg px-2.5 py-1 text-[12px] font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
              Limpar
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {grupos.map((g) => (
              <div key={g.id}>
                {grupos.length > 1 && linhaDeEscolha(g.estados.flatMap((e) => e.escolas.map((x) => x.id)), g.nome, 0)}
                {g.estados.map((e) => (
                  <div key={e.uf}>
                    {linhaDeEscolha(e.escolas.map((x) => x.id), e.uf, 1)}
                    {e.escolas.map((x) => linhaDeEscolha([x.id], x.nome, 2, x.id))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-2 dark:border-gray-800">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{marcadas.size ? `${marcadas.size} de ${todas.length} filiais` : "Marque ao menos uma filial"}</span>
            <button type="button" disabled={!marcadas.size} onClick={aplicar} className="rounded-lg bg-na-green px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
