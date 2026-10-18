"use client";

import { Check, Copy } from "lucide-react";
import { useId, useState } from "react";

/** Se o navegador bloquear a cópia, mantém o código disponível para seleção manual. */
export function CopyButton({ value, label = "Copiar código PIX", manualLabel = "Código PIX para copiar manualmente" }: { value: string; label?: string; manualLabel?: string }) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const id = useId();

  async function copiar() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="w-full">
      <button type="button" onClick={copiar} disabled={!value || status === "copying"} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
        {status === "copied" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        <span>{status === "copied" ? "Copiado!" : status === "copying" ? "Copiando..." : label}</span>
      </button>
      <p role="status" className="sr-only">{status === "copied" ? "Copiado para a área de transferência." : ""}</p>
      {status === "error" && (
        <div className="mt-2 text-left">
          <p role="alert" className="mb-2 text-sm text-na-danger-dark dark:text-na-danger-light">O navegador bloqueou a cópia. Toque no campo abaixo para selecionar o código e copie manualmente.</p>
          <label htmlFor={id} className="sr-only">{manualLabel}</label>
          <textarea id={id} readOnly value={value} rows={3} onFocus={(event) => event.currentTarget.select()} className="w-full resize-none rounded-lg border border-gray-300 bg-white p-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
        </div>
      )}
    </div>
  );
}
