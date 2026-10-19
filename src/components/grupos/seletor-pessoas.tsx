"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

export type PessoaOpcao = { id: string; name: string; isMembroPrograma?: boolean };

/**
 * Busca por nome e seleção de várias pessoas. A lista de quem pode ser
 * escolhido vem do servidor (buscar), que já aplica a regra do grupo: só
 * membros, alunos também, só FV etc.
 */
export function SeletorPessoas({
  rotulo,
  ajuda,
  buscar,
  selecionados,
  onChange,
  bloqueados = [],
}: {
  rotulo: string;
  ajuda?: string;
  buscar: (termo: string) => Promise<PessoaOpcao[]>;
  selecionados: PessoaOpcao[];
  onChange: (p: PessoaOpcao[]) => void;
  bloqueados?: string[];
}) {
  const id = useId();
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<PessoaOpcao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const t = setTimeout(() => {
      setCarregando(true);
      buscar(termo)
        .then((r) => ativo && setOpcoes(r))
        .catch(() => ativo && setOpcoes([]))
        .finally(() => ativo && setCarregando(false));
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [termo, aberto, buscar]);

  const escolhidos = new Set(selecionados.map((s) => s.id));
  const visiveis = opcoes.filter((o) => !escolhidos.has(o.id) && !bloqueados.includes(o.id));

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">
        {rotulo}
      </label>
      {ajuda && <p className="-mt-1 text-[11px] text-gray-500 dark:text-gray-400">{ajuda}</p>}
      {selecionados.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selecionados.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full bg-na-green-light py-0.5 pr-1 pl-2.5 text-[11px] font-semibold text-na-green-dark dark:bg-emerald-950/50 dark:text-emerald-300">
              {p.name}
              <button type="button" onClick={() => onChange(selecionados.filter((s) => s.id !== p.id))} aria-label={`Tirar ${p.name}`} className="rounded-full p-0.5 hover:bg-black/10">
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400" />
        <input
          id={id}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar pelo nome"
          autoComplete="off"
          className="min-h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-8 text-[13px] text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        {aberto && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {carregando && (
              <p className="flex items-center gap-1.5 p-3 text-[12px] text-gray-500">
                <Loader2 size={12} className="animate-spin" /> Buscando…
              </p>
            )}
            {!carregando && visiveis.length === 0 && <p className="p-3 text-[12px] text-gray-500">Ninguém encontrado com esse nome.</p>}
            {!carregando &&
              visiveis.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange([...selecionados, o]);
                    setTermo("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {o.name}
                  {o.isMembroPrograma === false && <span className="text-[10px] text-gray-400">aluno</span>}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
