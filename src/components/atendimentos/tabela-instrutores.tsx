"use client";

import { ArrowDown } from "lucide-react";
import { useState } from "react";

type Linha = {
  id: string;
  nome: string;
  filial: string;
  horariosAbertos: number;
  livres: number;
  marcados: number;
  ocupacao: number | null;
  realizados30: number;
  faltas30: number;
  canceladosAluno30: number;
  canceladosInstrutor30: number;
  alunosAtendidos90: number;
  proximoLivre: string | null;
};

const FILTROS = {
  todos: { rotulo: "Todos", filtro: () => true, ordem: (a: Linha, b: Linha) => a.nome.localeCompare(b.nome, "pt-BR") },
  sem: { rotulo: "Sem horários abertos", filtro: (l: Linha) => l.horariosAbertos === 0, ordem: (a: Linha, b: Linha) => a.nome.localeCompare(b.nome, "pt-BR") },
  livres: { rotulo: "Mais livres", filtro: (l: Linha) => l.horariosAbertos > 0, ordem: (a: Linha, b: Linha) => b.livres - a.livres },
  cheios: { rotulo: "Mais cheios", filtro: (l: Linha) => l.horariosAbertos > 0, ordem: (a: Linha, b: Linha) => (b.ocupacao ?? 0) - (a.ocupacao ?? 0) || b.marcados - a.marcados },
} as const;

/** Tabela por instrutor com atalhos de leitura: quem não abriu horários, mais livres, mais cheios. */
export function TabelaInstrutores({ linhas, mostrarFilial }: { linhas: Linha[]; mostrarFilial: boolean }) {
  const [filtro, setFiltro] = useState<keyof typeof FILTROS>("todos");
  const f = FILTROS[filtro];
  const lista = linhas.filter(f.filtro).sort(f.ordem);
  const contagem = (k: keyof typeof FILTROS) => linhas.filter(FILTROS[k].filtro).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(FILTROS) as (keyof typeof FILTROS)[]).map((k) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${k === filtro ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:border-na-green dark:border-gray-700 dark:text-gray-300"}`}
          >
            {FILTROS[k].rotulo} <span className="opacity-75">{contagem(k)}</span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {linhas.length === 0 ? "Nenhum instrutor ativo encontrado nesta filial." : filtro === "sem" ? "Todos os instrutores abriram horários." : "Nenhum instrutor com horários abertos."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-gray-200 text-[11px] text-gray-500 uppercase dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Instrutor</th>
                {mostrarFilial && <th className="px-3 py-2.5 font-semibold">Filial</th>}
                <th className="px-3 py-2.5 text-right font-semibold">Abertos</th>
                <th className="px-3 py-2.5 text-right font-semibold">{filtro === "livres" && <ArrowDown size={11} className="mr-0.5 inline" />}Livres</th>
                <th className="px-3 py-2.5 text-right font-semibold">Marcadas</th>
                <th className="px-3 py-2.5 font-semibold">{filtro === "cheios" && <ArrowDown size={11} className="mr-0.5 inline" />}Ocupação</th>
                <th className="px-3 py-2.5 text-right font-semibold" title="Últimos 30 dias">Realizadas</th>
                <th className="px-3 py-2.5 text-right font-semibold" title="Últimos 30 dias">Faltas</th>
                <th className="px-3 py-2.5 text-right font-semibold" title="Últimos 30 dias: pelo aluno / pelo instrutor">Cancel.</th>
                <th className="px-3 py-2.5 text-right font-semibold" title="Alunos diferentes, últimos 90 dias">Alunos</th>
                <th className="px-3 py-2.5 font-semibold">Próximo livre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {lista.map((l) => (
                <tr key={l.id} className="text-gray-800 dark:text-gray-200">
                  <td className="px-3 py-2.5 font-semibold">{l.nome}</td>
                  {mostrarFilial && <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{l.filial}</td>}
                  {l.horariosAbertos === 0 ? (
                    <td colSpan={4} className="px-3 py-2.5">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Sem horários abertos</span>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2.5 text-right tabular-nums">{l.horariosAbertos}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{l.livres}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{l.marcados}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <span className="block h-full rounded-full bg-na-green" style={{ width: `${Math.round((l.ocupacao ?? 0) * 100)}%` }} />
                          </span>
                          <span className="text-[12px] tabular-nums">{Math.round((l.ocupacao ?? 0) * 100)}%</span>
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.realizados30}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.faltas30}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {l.canceladosAluno30}/{l.canceladosInstrutor30}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.alunosAtendidos90}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">
                    {l.proximoLivre ? new Date(l.proximoLivre).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
