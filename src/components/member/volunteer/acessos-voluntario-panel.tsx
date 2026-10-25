"use client";

import { liberarAcessoVoluntario, revogarAcessoVoluntario } from "@/lib/actions/acesso-voluntario-actions";
import { Check, Loader2, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

interface Pessoa {
  id: string;
  name: string;
  filial: string | null;
  papel: string[];
  grupos: string[];
  schoolId: string;
  cidade: string | null;
  secretarias: string[];
  sugerido: boolean;
  liberado: boolean;
}

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
const SEM_SECRETARIA = "__nenhuma__";
const selectCls =
  "min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

export function AcessosVoluntarioPanel({ pessoas, mostrarSugeridos }: { pessoas: Pessoa[]; mostrarSugeridos: boolean }) {
  const [liberados, setLiberados] = useState(() => new Set(pessoas.filter((p) => p.liberado).map((p) => p.id)));
  const [busca, setBusca] = useState("");
  const [filial, setFilial] = useState("");
  const [secretaria, setSecretaria] = useState("");
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filiais = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pessoas) m.set(p.schoolId, p.cidade ?? "Sem cidade");
    return [...m].sort((a, b) => porNome(a[1], b[1]));
  }, [pessoas]);
  const secretarias = useMemo(() => [...new Set(pessoas.flatMap((p) => p.secretarias))].sort(porNome), [pessoas]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return pessoas
      .filter(
        (p) =>
          (!q || normalizar(p.name).includes(q)) &&
          (!filial || p.schoolId === filial) &&
          (!secretaria || (secretaria === SEM_SECRETARIA ? p.secretarias.length === 0 : p.secretarias.includes(secretaria))),
      )
      .sort((a, b) => porNome(a.name, b.name));
  }, [busca, filial, secretaria, pessoas]);
  const semFiltro = !busca && !filial && !secretaria;
  const sugeridas = mostrarSugeridos && semFiltro ? filtradas.filter((p) => p.sugerido) : [];
  const demais = mostrarSugeridos && semFiltro ? filtradas.filter((p) => !p.sugerido) : filtradas;

  function alternar(p: Pessoa) {
    const liberar = !liberados.has(p.id);
    setErro(null);
    setEmAndamento(p.id);
    startTransition(async () => {
      const r = liberar ? await liberarAcessoVoluntario(p.id) : await revogarAcessoVoluntario(p.id);
      setEmAndamento(null);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setLiberados((atual) => {
        const novo = new Set(atual);
        if (liberar) novo.add(p.id);
        else novo.delete(p.id);
        return novo;
      });
    });
  }

  function Linha({ p }: { p: Pessoa }) {
    const ok = liberados.has(p.id);
    return (
      <li className="flex items-center justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
          {(p.filial || p.papel.length > 0 || p.grupos.length > 0) && (
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{[...(p.filial ? [p.filial] : []), ...p.papel, ...p.grupos].join(" · ")}</p>
          )}
        </div>
        <button
          onClick={() => alternar(p)}
          disabled={emAndamento === p.id}
          aria-pressed={ok}
          className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-60 ${
            ok
              ? "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          {emAndamento === p.id ? <Loader2 size={12} className="animate-spin" /> : ok ? <Check size={12} /> : null}
          {ok ? "Liberado" : "Liberar"}
        </button>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 dark:border-gray-700">
        <Search size={14} className="text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>
      {(filiais.length > 1 || secretarias.length > 0) && (
        <div className="-mt-2 flex flex-wrap gap-2">
          {filiais.length > 1 && (
            <select value={filial} onChange={(e) => setFilial(e.target.value)} aria-label="Filtrar por filial" className={selectCls}>
              <option value="">Todas as filiais</option>
              {filiais.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          )}
          {secretarias.length > 0 && (
            <select value={secretaria} onChange={(e) => setSecretaria(e.target.value)} aria-label="Filtrar por secretaria" className={selectCls}>
              <option value="">Todas as secretarias</option>
              {secretarias.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={SEM_SECRETARIA}>Sem secretaria</option>
            </select>
          )}
        </div>
      )}
      <p className="-mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        {semFiltro ? "" : `${filtradas.length} de ${pessoas.length} na lista · `}
        {liberados.size} {liberados.size === 1 ? "pessoa liberada" : "pessoas liberadas"}. Toque de novo em “Liberado” pra retirar o acesso.
      </p>

      {erro && <p className="text-[11px] text-na-danger-dark dark:text-red-300">{erro}</p>}

      {sugeridas.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Sugeridos: chefes de grupo, sub-chefes e secretários</h2>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 px-3 dark:divide-gray-800 dark:border-gray-700">
            {sugeridas.map((p) => (
              <Linha key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}

      {demais.length > 0 ? (
        <section>
          {sugeridas.length > 0 && <h2 className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Demais pessoas</h2>}
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 px-3 dark:divide-gray-800 dark:border-gray-700">
            {demais.map((p) => (
              <Linha key={p.id} p={p} />
            ))}
          </ul>
        </section>
      ) : (
        sugeridas.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">Ninguém encontrado.</p>
      )}
    </div>
  );
}
