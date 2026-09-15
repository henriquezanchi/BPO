"use client";

import { viewReceiptByMercurioRecId } from "@/lib/actions/receipt-actions";
import { formatBRL } from "@/lib/format";
import type { ContributionMonthlyStatus } from "@prisma/client";
import { AlertTriangle, Loader2, Printer } from "lucide-react";
import { useState, useTransition } from "react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ESTILO_POR_STATUS: Record<string, string> = {
  paga: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  atrasado: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
  isento: "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
  em_branco: "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500",
};

const LABEL_POR_STATUS: Record<string, string> = {
  paga: "Paga",
  atrasado: "Em atraso",
  isento: "Isento",
  em_branco: "—",
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function handleImprimir(rawText: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(`<pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap; margin: 0;">${escapeHtml(rawText)}</pre>`);
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => document.body.removeChild(iframe), 1000);
}

/**
 * Situação real da contribuição mês a mês, sincronizada da Ficha Anual do
 * Mercúrio (ver scripts/sync-monthly-status.ts). Cada mês é clicável:
 * PAGA abre o recibo daquele mês (mesmo fluxo de "Histórico & Recibos",
 * unificado aqui — ver viewReceiptByMercurioRecId); ATRASADO/EM BRANCO
 * abre uma tela de pagamento SIMULADA (sem gateway real conectado ainda,
 * ver .env.example ASAAS_API_KEY vazio).
 */
export function ContributionStatusPanel({
  memberId,
  monthlyStatus,
  compositionTotal,
}: {
  memberId: string;
  monthlyStatus: ContributionMonthlyStatus[];
  compositionTotal: number;
}) {
  const [recibo, setRecibo] = useState<string | null>(null);
  const [mesPagamento, setMesPagamento] = useState<number | null>(null);
  const [carregandoMes, setCarregandoMes] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const porMes = new Map(monthlyStatus.map((m) => [m.month, m]));
  const mesesAtrasados = monthlyStatus.filter((m) => m.status === "atrasado");

  function handleClickMes(mes: number) {
    const registro = porMes.get(mes);
    const status = registro?.status ?? "em_branco";
    setErro(null);

    if (status === "paga") {
      if (!registro?.mercurioRecId) return;
      setCarregandoMes(mes);
      startTransition(async () => {
        const res = await viewReceiptByMercurioRecId(memberId, registro.mercurioRecId!);
        setCarregandoMes(null);
        if (!res.ok) {
          setErro(res.error ?? "Falha ao buscar o comprovante.");
          return;
        }
        setRecibo(res.rawText);
      });
      return;
    }

    if (status === "atrasado" || status === "em_branco") {
      setMesPagamento(mes);
    }
  }

  if (recibo) {
    return (
      <div className="text-left">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">Comprovante</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleImprimir(recibo)}
              className="flex items-center gap-1 text-[11px] font-semibold text-na-green dark:text-emerald-400"
            >
              <Printer size={12} /> Imprimir
            </button>
            <button onClick={() => setRecibo(null)} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Voltar
            </button>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-tight whitespace-pre-wrap dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {recibo}
        </pre>
      </div>
    );
  }

  if (mesPagamento !== null) {
    return (
      <SimulatedPaymentScreen mes={mesPagamento} amount={compositionTotal} onVoltar={() => setMesPagamento(null)} />
    );
  }

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Situação da sua contribuição em {new Date().getFullYear()}:
      </p>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {MESES.map((nome, i) => {
          const mes = i + 1;
          const registro = porMes.get(mes);
          const status = registro?.status ?? "em_branco";
          const clicavel = status === "paga" || status === "atrasado" || status === "em_branco";
          return (
            <button
              key={mes}
              onClick={() => clicavel && handleClickMes(mes)}
              disabled={!clicavel || (isPending && carregandoMes === mes)}
              className={`rounded-lg border p-2 text-center text-[11px] transition ${ESTILO_POR_STATUS[status]} ${
                clicavel ? "cursor-pointer hover:brightness-95" : "cursor-default"
              }`}
            >
              <div className="font-semibold">{nome}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1">
                {isPending && carregandoMes === mes ? <Loader2 size={10} className="animate-spin" /> : LABEL_POR_STATUS[status]}
              </div>
            </button>
          );
        })}
      </div>

      {erro && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {mesesAtrasados.length > 0 ? (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Clique num mês em atraso pra pagar. Meses pagos mostram o comprovante.
        </p>
      ) : (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Nenhum mês em atraso este ano.</p>
      )}
    </div>
  );
}

function SimulatedPaymentScreen({ mes, amount, onVoltar }: { mes: number; amount: number; onVoltar: () => void }) {
  const [metodo, setMetodo] = useState<"pix" | "cartao">("pix");
  const [pago, setPago] = useState(false);

  return (
    <div className="text-left">
      <button onClick={onVoltar} className="mb-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        ← Voltar
      </button>

      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        Simulação — o pagamento pelo Portal ainda não está conectado a um gateway real. Esta tela mostra como vai
        funcionar quando estiver pronto.
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 p-4 text-center dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">Contribuição de {MESES[mes - 1]}</p>
        <p className="mt-1 text-2xl font-bold text-na-green-dark dark:text-emerald-400">{formatBRL(amount)}</p>
      </div>

      {pago ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Pagamento simulado com sucesso. Quando o gateway estiver ligado, isso vai gerar a cobrança de verdade e
          lançar automaticamente no Mercúrio.
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
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

          <button
            onClick={() => setPago(true)}
            className="w-full rounded-xl bg-na-green px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-na-green-dark"
          >
            Pagar {formatBRL(amount)} via {metodo === "pix" ? "PIX" : "Cartão"}
          </button>
        </>
      )}
    </div>
  );
}
