"use client";

import { CATEGORIAS_CUSTO } from "@/lib/aberturas/categorias";
import { useState } from "react";
import { CAMPO_CLASS } from "./form-action";

const reais = (centavos: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
const paraCentavos = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

/**
 * Orçamento da abertura (pedido do usuário 2026-10-25): em branco, um valor único ou detalhado por item, somado
 * no fim. Envia `orcamento` (total em reais) e `orcamentoItens` (JSON categoria → reais; vazio no valor único).
 */
export function CampoOrcamento({ totalCentavos, itensIniciais }: { totalCentavos: number; itensIniciais: Record<string, number> }) {
  const [detalhado, setDetalhado] = useState(Object.values(itensIniciais).some((v) => v > 0));
  const [unico, setUnico] = useState(totalCentavos > 0 ? (totalCentavos / 100).toFixed(2) : "");
  const [itens, setItens] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIAS_CUSTO.map(([k]) => [k, itensIniciais[k] ? (itensIniciais[k] / 100).toFixed(2) : ""])),
  );
  const somaItens = Object.values(itens).reduce((s, v) => s + paraCentavos(v), 0);
  const total = detalhado ? somaItens : paraCentavos(unico);

  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Orçamento</span>
        <div className="inline-flex rounded-lg border border-gray-300 p-0.5 text-[12px] font-semibold dark:border-gray-700" role="group" aria-label="Forma do orçamento">
          {[
            [false, "Valor único"],
            [true, "Detalhar por item"],
          ].map(([v, r]) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={detalhado === v}
              onClick={() => setDetalhado(v as boolean)}
              className={`rounded-md px-2.5 py-1 ${detalhado === v ? "bg-na-green text-white" : "text-gray-600 dark:text-gray-300"}`}
            >
              {r as string}
            </button>
          ))}
        </div>
      </div>
      {detalhado ? (
        <div className="grid gap-x-4 gap-y-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-800">
          {CATEGORIAS_CUSTO.map(([k, rotulo]) => (
            <label key={k} className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300">
              <span>{rotulo}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                aria-label={`${rotulo} (R$)`}
                value={itens[k]}
                onChange={(e) => setItens((atual) => ({ ...atual, [k]: e.target.value }))}
                className={`${CAMPO_CLASS} text-right tabular-nums`}
              />
            </label>
          ))}
          <p className="flex items-center justify-between border-t border-gray-100 pt-2 text-[13px] font-bold text-gray-900 sm:col-span-2 dark:border-gray-800 dark:text-gray-100">
            <span>Total</span>
            <span className="tabular-nums">{reais(somaItens)}</span>
          </p>
        </div>
      ) : (
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="Em branco se ainda não sabe"
          aria-label="Orçamento (R$)"
          value={unico}
          onChange={(e) => setUnico(e.target.value)}
          className={CAMPO_CLASS}
        />
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">Opcional. Com o orçamento e as despesas lançadas, o Portal calcula o custo de cada nova matrícula.</p>
      <input type="hidden" name="orcamento" value={(total / 100).toFixed(2)} />
      <input type="hidden" name="orcamentoItens" value={detalhado ? JSON.stringify(Object.fromEntries(Object.entries(itens).filter(([, v]) => paraCentavos(v) > 0))) : "{}"} />
    </div>
  );
}
