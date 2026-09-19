"use client";

import { buscarClientesFortunaPorNome, vincularMembroFortuna } from "@/lib/actions/fortuna-actions";
import type { DirectorDashboard } from "@/lib/director-data";
import { formatBRL } from "@/lib/format";
import type { FortunaClient } from "@/lib/fortuna/client";
import { Coffee, Link2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { EmptyState, KpiCard } from "./diretor-dashboard";

export function FortunaTab({ schoolId, data }: { schoolId: string; data: DirectorDashboard }) {
  const [isPending, startTransition] = useTransition();
  const [membroEmBusca, setMembroEmBusca] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<FortunaClient[]>([]);
  const [buscando, setBuscando] = useState(false);

  async function handleBuscar() {
    setBuscando(true);
    try {
      setResultados(await buscarClientesFortunaPorNome(schoolId, busca));
    } finally {
      setBuscando(false);
    }
  }

  function handleVincular(memberId: string, fortunaClientId: number) {
    startTransition(async () => {
      await vincularMembroFortuna(schoolId, memberId, fortunaClientId);
      setMembroEmBusca(null);
      setResultados([]);
      setBusca("");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <KpiCard
        title="Saldo Consolidado (membros vinculados ao Fortuna)"
        value={formatBRL(data.kpis.saldoFortunaConsolidado)}
        sub="Lido em tempo real da API do Fortuna"
        accent="gold"
        icon={Coffee}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-bold text-na-green-dark dark:text-emerald-400">Saldo por Membro</h3>
        {data.fortunaSaldosPorMembro.length === 0 ? (
          <EmptyState text="Nenhum membro vinculado ao Fortuna ainda." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.fortunaSaldosPorMembro.map((s) => (
              <li key={s.memberId} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                <span className="font-medium text-gray-900 dark:text-gray-100">{s.memberName}</span>
                <span className="font-semibold text-na-green dark:text-emerald-400">{formatBRL(s.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-bold text-na-green-dark dark:text-emerald-400">Membros sem vínculo Fortuna</h3>
        <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">Busca por nome direto na API do Fortuna — confirme e-mail/telefone antes de vincular (nome sozinho pode bater errado).</p>
        {data.fortunaNaoVinculados.length === 0 ? (
          <EmptyState text="Todos os membros ativos já estão vinculados." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.fortunaNaoVinculados.map((m) => (
              <li key={m.id} className="rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{m.name}</span>
                  <button
                    onClick={() => {
                      setMembroEmBusca(membroEmBusca === m.id ? null : m.id);
                      setBusca(m.name);
                      setResultados([]);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <Link2 size={12} /> Vincular
                  </button>
                </div>
                {membroEmBusca === m.id && (
                  <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <div className="flex gap-2">
                      <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Nome no Fortuna..."
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-[13px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <button onClick={handleBuscar} disabled={buscando} className="rounded-lg bg-gray-800 px-3 py-1.5 text-[11px] font-semibold text-white dark:bg-gray-700">
                        {buscando ? <Loader2 size={12} className="animate-spin" /> : "Buscar"}
                      </button>
                    </div>
                    {resultados.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1">
                        {resultados.map((c) => (
                          <li key={c.id} className="flex items-center justify-between rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-800">
                            <span className="text-gray-700 dark:text-gray-300">
                              {c.name} — {c.cellPhone} — {c.email}
                            </span>
                            <button
                              onClick={() => handleVincular(m.id, c.id)}
                              disabled={isPending}
                              className="rounded bg-na-green px-2 py-0.5 font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
                            >
                              Confirmar
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-bold text-na-green-dark dark:text-emerald-400">Movimentações Recentes</h3>
        {data.fortunaTransacoes.length === 0 ? (
          <EmptyState text="Nenhuma movimentação Fortuna registrada localmente ainda — a API do Fortuna não tem endpoint de extrato hoje, só saldo." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.fortunaTransacoes.map((t, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                <span className="font-medium text-gray-900 dark:text-gray-100">{t.memberName}</span>
                <span className={`font-semibold ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {formatBRL(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
