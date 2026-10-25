"use client";

import type { PessoaUso } from "@/lib/uso-portal";
import { Bell, Search } from "lucide-react";
import { useMemo, useState } from "react";

const POR_PAGINA = 100;
const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Listas de quem usa e quem não usa o Portal, com busca por nome ou matrícula e "Mostrar mais". */
export function ListaUso({ usando, naoUsando, ativos, varias }: { usando: PessoaUso[]; naoUsando: PessoaUso[]; ativos: number; varias: boolean }) {
  const [lista, setLista] = useState<"nao" | "usando">("nao");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);
  const pessoas = lista === "usando" ? usando : naoUsando;
  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return q ? pessoas.filter((p) => normalizar(p.nome).includes(q) || p.matricula.includes(q)) : pessoas;
  }, [busca, pessoas]);
  const pct = (n: number) => (ativos ? Math.round((n / ativos) * 100) : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Ativos no Mercúrio", ativos, null],
          ["Usando o Portal", usando.length, `${pct(usando.length)}%`],
          ["Ainda não usam", naoUsando.length, `${pct(naoUsando.length)}%`],
        ].map(([rotulo, valor, detalhe]) => (
          <div key={rotulo as string} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-2xl font-black text-gray-900 tabular-nums dark:text-gray-100">{(valor as number).toLocaleString("pt-BR")}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {rotulo as string}
              {detalhe ? ` · ${detalhe}` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-gray-300 p-0.5 text-[12px] font-semibold dark:border-gray-700" role="tablist">
          {(
            [
              ["nao", `Não usam (${naoUsando.length})`],
              ["usando", `Usam (${usando.length})`],
            ] as const
          ).map(([id, r]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={lista === id}
              onClick={() => {
                setLista(id);
                setLimite(POR_PAGINA);
              }}
              className={`rounded-md px-3 py-1 ${lista === id ? "bg-na-green text-white" : "text-gray-600 dark:text-gray-300"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900">
          <Search size={14} className="text-gray-400" />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setLimite(POR_PAGINA);
            }}
            placeholder="Buscar por nome ou matrícula"
            className="w-full min-w-0 bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead className="text-[10px] text-gray-500 uppercase dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Nome</th>
              <th className="px-2 py-2 font-semibold">Matrícula</th>
              <th className="px-2 py-2 font-semibold">Nível</th>
              {varias && <th className="px-2 py-2 font-semibold">Filial</th>}
              {lista === "usando" && <th className="px-4 py-2 text-right font-semibold">Último acesso</th>}
            </tr>
          </thead>
          <tbody className="text-gray-800 dark:text-gray-200">
            {filtradas.slice(0, limite).map((p) => (
              <tr key={p.matricula} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-1.5">
                  <span className="flex items-center gap-1.5">
                    {p.nome}
                    {p.notificacoes && <Bell size={12} className="shrink-0 text-na-green dark:text-emerald-400" aria-label="Notificações ativas" />}
                  </span>
                </td>
                <td className="px-2 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{p.matricula}</td>
                <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400">{p.nivel}</td>
                {varias && <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400">{p.filial}</td>}
                {lista === "usando" && (
                  <td className="px-4 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                    {p.ultimoAcesso ? new Date(p.ultimoAcesso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Ninguém encontrado.</p>}
      </div>
      {filtradas.length > limite && (
        <button type="button" onClick={() => setLimite((n) => n + POR_PAGINA)} className="w-fit rounded-lg border border-gray-300 px-3 py-1.5 text-[13px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
          Mostrar mais ({filtradas.length - limite} restantes)
        </button>
      )}
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        <Bell size={11} className="inline" /> = notificações ativas. &quot;Usam&quot; = já entraram no Portal ao menos uma vez.
      </p>
    </div>
  );
}
