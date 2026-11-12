"use client";

/** Botão de impressão do cartaz do pátio. */
export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-10 rounded-lg bg-na-green px-4 text-sm font-bold text-white">
      Imprimir cartaz
    </button>
  );
}
