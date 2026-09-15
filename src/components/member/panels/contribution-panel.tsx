"use client";

import { viewReceipt } from "@/lib/actions/receipt-actions";
import { formatBRL, formatDateBR } from "@/lib/format";
import type { SerializedReceipt } from "@/lib/member-data";
import { AlertTriangle, FileText, Loader2, Printer } from "lucide-react";
import { useState, useTransition } from "react";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Recibos reais emitidos pela tesouraria no Mercúrio (ver ContributionReceipt) — não é mais um histórico simulado. */
export function ContributionPanel({ memberId, receipts }: { memberId: string; receipts: SerializedReceipt[] }) {
  const [aberto, setAberto] = useState<{ id: string; rawText: string } | null>(null);
  const [erroPorId, setErroPorId] = useState<Record<string, string>>({});
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // window.print() imprimiria a página inteira do Portal (o app por trás
  // do modal) — em vez disso, monta um iframe escondido só com o texto do
  // recibo e imprime a partir dele. Evita bloqueio de pop-up (diferente de
  // window.open, iframe não é considerado pop-up pelo navegador).
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
    doc.write(
      `<pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap; margin: 0;">${escapeHtml(rawText)}</pre>`,
    );
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }

  function handleVer(receipt: SerializedReceipt) {
    setErroPorId((prev) => ({ ...prev, [receipt.id]: "" }));
    setCarregandoId(receipt.id);
    startTransition(async () => {
      const res = await viewReceipt(memberId, receipt.id);
      setCarregandoId(null);
      if (!res.ok) {
        setErroPorId((prev) => ({ ...prev, [receipt.id]: res.error ?? "Falha ao buscar o comprovante." }));
        return;
      }
      setAberto({ id: receipt.id, rawText: res.rawText });
    });
  }

  if (aberto) {
    return (
      <div className="text-left">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">Comprovante</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleImprimir(aberto.rawText)}
              className="flex items-center gap-1 text-[11px] font-semibold text-na-green dark:text-emerald-400"
            >
              <Printer size={12} /> Imprimir
            </button>
            <button onClick={() => setAberto(null)} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Voltar
            </button>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-tight whitespace-pre-wrap dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {aberto.rawText}
        </pre>
      </div>
    );
  }

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Seus comprovantes de pagamento emitidos pela secretaria:</p>

      {receipts.length === 0 ? (
        <p className="rounded-xl border border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Nenhum comprovante encontrado ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {receipts.map((r) => (
            <div key={r.id} className="rounded-lg border border-gray-200 p-2.5 text-xs dark:border-gray-700">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <FileText size={12} className="text-gray-400" /> {formatDateBR(r.issuedAt)}
                </span>
                <strong>{formatBRL(r.amount)}</strong>
                <button
                  onClick={() => handleVer(r)}
                  disabled={isPending && carregandoId === r.id}
                  className="flex items-center gap-1 rounded-md bg-na-green px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
                >
                  {isPending && carregandoId === r.id ? <Loader2 size={11} className="animate-spin" /> : null}
                  Ver
                </button>
              </div>
              {erroPorId[r.id] && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-700 dark:text-red-400">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {erroPorId[r.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
