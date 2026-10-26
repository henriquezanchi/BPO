"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { CAMPO_CLASS } from "./form-action";
import { hora } from "./utils";

type Impedimento = { data: string; inicioMinuto: number; fimMinuto: number };
type Linha = { data: string; diaInteiro: boolean; inicio: string; fim: string };

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Datas em que o professor não pode, mesmo dentro da disponibilidade recorrente (viagem, compromisso).
 * Substitui o antigo campo em JSON (pedido do usuário 2026-10-25: "que impedimentos são esses?").
 * Envia `impedimentos` no mesmo formato de antes: [{ data, inicioMinuto, fimMinuto }].
 */
export function CampoImpedimentos({ iniciais }: { iniciais: Impedimento[] }) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    iniciais.map((i) => ({ data: i.data, diaInteiro: i.inicioMinuto === 0 && i.fimMinuto >= 1439, inicio: hora(i.inicioMinuto), fim: hora(Math.min(i.fimMinuto, 1439)) })),
  );
  const mudar = (i: number, parte: Partial<Linha>) => setLinhas((atual) => atual.map((l, k) => (k === i ? { ...l, ...parte } : l)));
  const valor: Impedimento[] = linhas
    .filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.data))
    .map((l) => (l.diaInteiro ? { data: l.data, inicioMinuto: 0, fimMinuto: 1440 } : { data: l.data, inicioMinuto: minutos(l.inicio), fimMinuto: minutos(l.fim) }));

  return (
    <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Datas em que não pode</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">Viagens e compromissos dentro do período acima. Essas datas saem da sugestão de horários.</span>
      </div>
      {linhas.map((l, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-2 dark:border-gray-800">
          <input type="date" aria-label="Data" value={l.data} onChange={(e) => mudar(i, { data: e.target.value })} className={`${CAMPO_CLASS} w-44`} />
          <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={l.diaInteiro} onChange={(e) => mudar(i, { diaInteiro: e.target.checked })} className="accent-na-green" />
            Dia inteiro
          </label>
          {!l.diaInteiro && (
            <span className="flex items-center gap-1.5 text-[13px] text-gray-600 dark:text-gray-300">
              das <input type="time" aria-label="Das" value={l.inicio} onChange={(e) => mudar(i, { inicio: e.target.value })} className={`${CAMPO_CLASS} w-28`} />
              às <input type="time" aria-label="Até" value={l.fim} onChange={(e) => mudar(i, { fim: e.target.value })} className={`${CAMPO_CLASS} w-28`} />
            </span>
          )}
          <button type="button" onClick={() => setLinhas((atual) => atual.filter((_, k) => k !== i))} aria-label="Remover data" className="ml-auto rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLinhas((atual) => [...atual, { data: "", diaInteiro: true, inicio: "19:00", fim: "21:30" }])}
        className="flex w-fit items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-[12px] font-semibold text-na-green-dark hover:border-na-green dark:border-gray-700 dark:text-emerald-400"
      >
        <Plus size={14} /> {linhas.length ? "Adicionar outra data" : "Adicionar data"}
      </button>
      <input type="hidden" name="impedimentos" value={JSON.stringify(valor)} />
    </div>
  );
}
