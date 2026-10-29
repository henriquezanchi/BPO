"use client";

import { useEffect } from "react";

/** Abre a impressão do navegador ao carregar ("Salvar como PDF"); o botão fica para tentar de novo. */
export function Imprimir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button onClick={() => window.print()} className="mb-6 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold print:hidden">
      Salvar como PDF
    </button>
  );
}
