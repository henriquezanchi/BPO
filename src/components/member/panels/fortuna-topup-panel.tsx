"use client";

import { formatBRL } from "@/lib/format";
import type { FortunaBalanceView } from "@/lib/member-data";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

/**
 * Tela de recarga do Fortuna — AINDA SIMULADA, não cobra nada de
 * verdade. Mostra como vai funcionar quando o gateway estiver
 * configurado: escolher a filial (inclusive uma diferente da sua, ex:
 * Ítaca antes de uma viagem), valor, forma de pagamento, e opcionalmente
 * ativar recarga automática mensal (débito automático) — mesmo padrão
 * usado pra contribuição (ver ContributionStatusPanel).
 */
export function FortunaTopUpPanel({ balances }: { balances: FortunaBalanceView[] }) {
  const home = balances.find((b) => b.isHome) ?? balances[0];
  const [branchId, setBranchId] = useState(home?.branchId);
  const [amount, setAmount] = useState("20,00");
  const [metodo, setMetodo] = useState<"pix" | "cartao">("pix");
  const [autoDebito, setAutoDebito] = useState(false);
  const [feito, setFeito] = useState(false);

  const branch = balances.find((b) => b.branchId === branchId) ?? home;
  const valorNumerico = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;

  if (feito) {
    return (
      <div className="text-left">
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Recarga simulada com sucesso em {branch?.branchTitle}
          {autoDebito && " — recarga automática mensal ativada"}. Quando o gateway estiver ligado, isso vai gerar a
          cobrança de verdade e creditar direto no Fortuna.
        </div>
      </div>
    );
  }

  return (
    <div className="text-left">
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle size={12} className="mr-1 inline" />
        Simulação — a recarga pelo Portal ainda não está conectada a um gateway real. Esta tela mostra como vai
        funcionar quando estiver pronto.
      </div>

      <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Filial</label>
      <select
        value={branchId}
        onChange={(e) => setBranchId(Number(e.target.value))}
        className="mb-3 w-full rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      >
        {balances.map((b) => (
          <option key={b.branchId} value={b.branchId}>
            {b.branchTitle}
            {b.isHome ? " (sua unidade)" : ""} — saldo atual {formatBRL(b.amount)}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Valor</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        className="mb-3 w-full rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />

      <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Forma de pagamento</label>
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setMetodo("pix")}
          className={`flex-1 rounded-lg border p-2.5 text-[13px] font-semibold ${
            metodo === "pix"
              ? "border-na-green bg-na-green-light text-na-green-dark dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
              : "border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
          }`}
        >
          PIX
        </button>
        <button
          onClick={() => setMetodo("cartao")}
          className={`flex-1 rounded-lg border p-2.5 text-[13px] font-semibold ${
            metodo === "cartao"
              ? "border-na-green bg-na-green-light text-na-green-dark dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
              : "border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
          }`}
        >
          Cartão
        </button>
      </div>

      <label className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-[12px] text-gray-700 dark:border-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={autoDebito} onChange={(e) => setAutoDebito(e.target.checked)} className="accent-na-green" />
        Recarregar automaticamente todo mês (débito automático), como a contribuição
      </label>

      <button
        onClick={() => setFeito(true)}
        disabled={valorNumerico <= 0}
        className="w-full rounded-xl bg-na-green px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        Adicionar {formatBRL(valorNumerico)} via {metodo === "pix" ? "PIX" : "Cartão"}
      </button>
    </div>
  );
}
