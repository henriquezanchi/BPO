"use client";

import { marcarLancadoAMao } from "@/lib/actions/cobranca-online-actions";
import { useState, useTransition } from "react";

/** Botão "Já lancei no Mercúrio" (Economia → Cobrança on-line → problemas de pagamento). Pede confirmação na própria linha. */
export function LancadoAMao({ tarefaId }: { tarefaId: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  if (!confirmar)
    return (
      <button type="button" onClick={() => setConfirmar(true)} className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        Já lancei no Mercúrio
      </button>
    );
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
      <span className="text-gray-600 dark:text-gray-400">O recibo já está no Mercúrio?</span>
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await marcarLancadoAMao(tarefaId);
            if (!r.ok) setErro(r.error);
          })
        }
        className="rounded-md bg-na-green px-2 py-1 font-semibold text-white disabled:opacity-60"
      >
        {pendente ? "Salvando…" : "Sim, já lancei"}
      </button>
      <button type="button" onClick={() => setConfirmar(false)} className="rounded-md px-2 py-1 font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
        Não
      </button>
      {erro && <span role="alert" className="text-red-700 dark:text-red-400">{erro}</span>}
    </span>
  );
}
