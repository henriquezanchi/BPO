"use client";

import type { Pergunta } from "@/lib/avaliacao-comum";

/** Uma pergunta do questionário (texto, escala ou escolha). */
export function CampoPergunta({ p, valor, onChange, nome }: { p: Pergunta; valor: unknown; onChange: (v: string | number) => void; nome: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-medium text-gray-900 dark:text-gray-100">
        {p.texto}
        {p.obrigatoria && <span className="ml-0.5 text-na-danger-dark dark:text-red-300">*</span>}
      </legend>

      {p.tipo === "texto" && (
        <textarea
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          maxLength={3000}
          className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
      )}

      {p.tipo === "escala" && (
        <div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: p.max! - p.min! + 1 }, (_, i) => p.min! + i).map((n) => (
              <label
                key={n}
                className={`flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2 text-[13px] font-semibold transition ${
                  valor === n ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <input type="radio" name={nome} value={n} checked={valor === n} onChange={() => onChange(n)} className="sr-only" />
                {n}
              </label>
            ))}
          </div>
          {(p.rotuloMin || p.rotuloMax) && (
            <div className="mt-1 flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <span>{p.rotuloMin}</span>
              <span>{p.rotuloMax}</span>
            </div>
          )}
        </div>
      )}

      {p.tipo === "escolha" && (
        <div className="flex flex-col gap-1.5">
          {p.opcoes!.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 text-[13px] text-gray-800 dark:text-gray-200">
              <input type="radio" name={nome} value={o} checked={valor === o} onChange={() => onChange(o)} className="h-4 w-4 accent-na-green" />
              {o}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
