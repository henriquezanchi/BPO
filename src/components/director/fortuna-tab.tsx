"use client";

import {
  buscarClientesFortunaPorNome,
  marcarRecargaContribuicaoFortunaComoLancada,
  marcarRecargaFortunaComoLancada,
  tentarNovamenteCreditoFortuna,
  tentarNovamenteCreditoFortunaContribuicao,
  vincularMembroFortuna,
  type FortunaBalancesForDirector,
} from "@/lib/actions/fortuna-actions";
import type { DirectorDashboard } from "@/lib/director-data";
import { formatBRL, formatDateBR } from "@/lib/format";
import type { FortunaClient } from "@/lib/fortuna/client";
import { CircleCheck, Coffee, Link2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { EmptyState, KpiCard } from "./diretor-dashboard";

export function FortunaTab({
  schoolId,
  data,
  balances,
  carregando,
}: {
  schoolId: string;
  data: DirectorDashboard;
  balances: FortunaBalancesForDirector;
  carregando: boolean;
}) {
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

  function handleMarcarLancada(id: string, source: "topup" | "contribuicao") {
    const nome = prompt("Quem está confirmando o lançamento manual? (nome — opcional)") ?? "";
    startTransition(() =>
      source === "topup" ? marcarRecargaFortunaComoLancada(schoolId, id, nome) : marcarRecargaContribuicaoFortunaComoLancada(schoolId, id, nome),
    );
  }

  function handleTentarNovamente(id: string, source: "topup" | "contribuicao") {
    startTransition(() => (source === "topup" ? tentarNovamenteCreditoFortuna(schoolId, id) : tentarNovamenteCreditoFortunaContribuicao(schoolId, id)));
  }

  return (
    <div className="flex flex-col gap-5">
      <KpiCard
        title="Saldo Consolidado (membros vinculados ao Fortuna)"
        value={carregando ? "..." : formatBRL(balances.saldoConsolidado)}
        sub="Lido em tempo real da API do Fortuna"
        accent="gold"
        icon={Coffee}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-bold text-na-green-dark dark:text-emerald-400">Recargas Pagas — Falha no Crédito Automático</h3>
        <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">
          O crédito no Fortuna já é automático assim que o PIX é confirmado. Só aparece aqui quando essa chamada falhou (membro
          desvinculado, API fora do ar etc.) — tente de novo, e só use o lançamento manual se a nova tentativa também falhar.
        </p>
        {data.recargasFortunaPendentes.length === 0 ? (
          <EmptyState text="Nenhuma recarga com falha de crédito automático." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recargasFortunaPendentes.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{r.memberName}</span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Pago em {formatDateBR(r.paidAt)}
                      {r.source === "contribuicao" && " — recarga combinada com a contribuição"}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBRL(r.amount)}</span>
                </div>
                {r.autoCreditError && <p className="text-[11px] text-red-700 dark:text-red-400">Erro: {r.autoCreditError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTentarNovamente(r.id, r.source)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-na-green px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
                  >
                    <CircleCheck size={12} /> Tentar creditar de novo
                  </button>
                  <button
                    onClick={() => handleMarcarLancada(r.id, r.source)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Marcar lançada manualmente
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-bold text-na-green-dark dark:text-emerald-400">Saldo por Membro</h3>
        {carregando ? (
          <p className="flex items-center gap-1.5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Buscando saldos no Fortuna...
          </p>
        ) : balances.saldosPorMembro.length === 0 ? (
          <EmptyState text="Nenhum membro vinculado ao Fortuna ainda." />
        ) : (
          <ul className="flex flex-col gap-2">
            {balances.saldosPorMembro.map((s) => (
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
