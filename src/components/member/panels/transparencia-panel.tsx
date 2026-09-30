"use client";

import { getTransparenciaParaMembro } from "@/lib/actions/transparency-actions";
import { formatBRL } from "@/lib/format";
import type { TransparenciaFinanceira } from "@/lib/transparency-data";
import { ChevronLeft, ChevronRight, Coffee, Handshake, Loader2, Ticket, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Transparência Financeira — pedido de dirigentes repassado pelo usuário
 * 2026-09-30: mostrar pros membros em que o dinheiro da escola é usado,
 * de forma prática (indicadores), não um balanço contábil cru. Sempre
 * dados REALIZADOS do mês (o que já entrou/já saiu), navegável mês a mês.
 */
export function TransparenciaPanel({ memberId }: { memberId: string }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  // `dados` guarda o ano/mês da resposta junto do valor — só considera
  // "carregado" quando bate com o mês selecionado (evita setState síncrono
  // no corpo do efeito pra resetar um "carregando" à parte).
  const [dados, setDados] = useState<TransparenciaFinanceira | null>(null);

  useEffect(() => {
    getTransparenciaParaMembro(memberId, ano, mes).then(setDados);
  }, [memberId, ano, mes]);

  const carregando = !dados || dados.ano !== ano || dados.mes !== mes;

  function mudarMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 1) {
      novoMes = 12;
      novoAno--;
    } else if (novoMes > 12) {
      novoMes = 1;
      novoAno++;
    }
    setMes(novoMes);
    setAno(novoAno);
  }

  return (
    <div className="text-left">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => mudarMes(-1)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {MESES[mes - 1]} / {ano}
        </p>
        <button onClick={() => mudarMes(1)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronRight size={16} />
        </button>
      </div>

      {carregando || !dados ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-gray-200 p-4 text-center dark:border-gray-700">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Resultado do Mês</p>
            <p className={`mt-1 text-2xl font-bold ${dados.resultado >= 0 ? "text-na-green-dark dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {formatBRL(dados.resultado)}
            </p>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              {formatBRL(dados.receitaTotal)} arrecadados − {formatBRL(dados.despesaTotal)} gastos
            </p>
          </div>

          <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">De onde veio</p>
          <ul className="mb-4 flex flex-col gap-1.5">
            <ItemReceita icon={<Wallet size={14} />} label="Contribuições" valor={dados.receitas.contribuicoes} />
            <ItemReceita icon={<Ticket size={14} />} label="Eventos" valor={dados.receitas.eventos} />
            <ItemReceita icon={<Coffee size={14} />} label="Lanchonete (Fortuna)" valor={dados.receitas.lanchonete} />
            {dados.receitas.outras.map((o) => (
              <ItemReceita key={o.categoria} icon={<Handshake size={14} />} label={o.label} valor={o.valor} />
            ))}
          </ul>

          <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 p-3 text-[11px] dark:bg-amber-950/30">
            <span className="text-amber-800 dark:text-amber-300">Taxa de inadimplência entre os membros</span>
            <span className="font-bold text-amber-800 dark:text-amber-300">{dados.taxaInadimplencia.toFixed(1)}%</span>
          </div>

          <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Em que foi usado</p>
          {dados.despesasPorCategoria.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-gray-400 dark:text-gray-500">Nenhuma despesa registrada neste mês ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dados.despesasPorCategoria.map((d) => {
                const percentual = dados.despesaTotal > 0 ? (d.valor / dados.despesaTotal) * 100 : 0;
                return (
                  <li key={d.categoria}>
                    <div className="mb-0.5 flex items-center justify-between text-[12px]">
                      <span className="text-gray-700 dark:text-gray-300">{d.categoria}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBRL(d.valor)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-full rounded-full bg-na-green" style={{ width: `${percentual}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {dados.despesasNaoCategorizadas > 0 && (
            <p className="mt-3 text-center text-[10px] text-gray-400 dark:text-gray-500">
              {dados.despesasNaoCategorizadas} despesa(s) deste mês ainda sem categoria — não aparecem no gráfico acima.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ItemReceita({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: number }) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-[12px] dark:bg-gray-800">
      <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        {icon} {label}
      </span>
      <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBRL(valor)}</span>
    </li>
  );
}
