"use client";

import { formatBRL } from "@/lib/format";
import type { FortunaBalanceView } from "@/lib/member-data";
import { Coffee, Loader2, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

/**
 * Saldo real do Fortuna (carteira da lanchonete), lido ao vivo — ver
 * getFortunaBalancesForMember. Um membro pode ter saldo em mais de 1
 * filial (ex: visitou outra unidade em um evento) — mostra a filial de
 * casa por padrão, com um seletor pras outras onde já existe saldo, pra
 * dar pra recarregar ANTES de viajar pra lá.
 *
 * "Adicionar Créditos" abre a tela de recarga real (PIX via Asaas, ver
 * FortunaTopUpPanel) — o crédito em si não é automático (Fortuna sem API
 * de escrita), então o botão de atualizar aqui deixa o membro conferir se
 * a tesouraria já lançou, sem precisar recarregar o Portal inteiro.
 */
export function FortunaWalletCard({
  balances,
  loading,
  onAdicionarCreditos,
  onAtualizar,
}: {
  balances: FortunaBalanceView[];
  loading?: boolean;
  onAdicionarCreditos: () => void;
  onAtualizar: () => void;
}) {
  const home = balances.find((b) => b.isHome) ?? balances[0];
  const [selecionada, setSelecionada] = useState(home?.branchId);
  const atual = balances.find((b) => b.branchId === selecionada) ?? home;

  if (!atual) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <span className="mb-3 block text-[11px] font-semibold text-na-gold">
          <Coffee size={12} className="mr-1 inline" /> CARTEIRA DIGITAL FORTUNA
        </span>
        {loading ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Buscando seu saldo...
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">Ainda não conseguimos localizar sua conta no Fortuna.</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-na-gold">
          <Coffee size={12} className="mr-1 inline" /> CARTEIRA DIGITAL FORTUNA
        </span>
        {balances.length > 1 && (
          <select
            value={selecionada}
            onChange={(e) => setSelecionada(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-[11px] text-gray-600 outline-none dark:border-gray-700 dark:text-gray-300"
          >
            {balances.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.branchTitle}
                {b.isHome ? " (sua unidade)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            Saldo em {atual.branchTitle}
            <button onClick={onAtualizar} disabled={loading} title="Atualizar saldo" className="text-gray-400 transition hover:text-na-green disabled:opacity-60">
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="text-2xl font-bold text-na-green dark:text-emerald-400">{formatBRL(atual.amount)}</div>
        </div>
        <button
          onClick={onAdicionarCreditos}
          className="flex items-center gap-1.5 rounded-xl bg-na-green px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-na-green-dark"
        >
          <Plus size={14} /> Adicionar Créditos
        </button>
      </div>
    </section>
  );
}
