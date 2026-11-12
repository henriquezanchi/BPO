"use client";

import { contatoAtendido } from "@/lib/actions/cobranca-online-actions";
import { useTransition } from "react";

/** "Já falei com a pessoa" (pedido de contato pelo WhatsApp, Economia → Cobrança on-line). */
export function ContatoAtendido({ schoolId, memberId }: { schoolId: string; memberId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(async () => void (await contatoAtendido(schoolId, memberId)))}
      className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      {pendente ? "Salvando…" : "Já falei com a pessoa"}
    </button>
  );
}
