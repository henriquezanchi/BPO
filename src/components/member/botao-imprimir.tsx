"use client";

import { Printer } from "lucide-react";

/** Abre a impressão do navegador (que também salva em PDF). */
export function BotaoImprimir({ rotulo = "Imprimir ou salvar em PDF" }: { rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
    >
      <Printer size={16} /> {rotulo}
    </button>
  );
}
