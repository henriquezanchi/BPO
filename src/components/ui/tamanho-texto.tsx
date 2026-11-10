"use client";

import { useSyncExternalStore } from "react";

/**
 * Letra maior (avaliação de design, 10/11/2026: membros de mais idade). Alterna a classe "texto-grande" na <html>
 * (aplicada antes de desenhar pelo script de layout.tsx) e guarda a escolha no aparelho.
 */
const CHAVE = "na-texto";
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => (ouvintes.add(f), () => ouvintes.delete(f));
const ler = () => document.documentElement.classList.contains("texto-grande");

export function TamanhoTexto({ className }: { className?: string }) {
  const grande = useSyncExternalStore(assinar, ler, () => false);
  function alternar() {
    document.documentElement.classList.toggle("texto-grande", !grande);
    try {
      if (grande) localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, "grande");
    } catch {
      /* sem localStorage: vale só nesta visita */
    }
    ouvintes.forEach((f) => f());
  }
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={grande}
      aria-label={grande ? "Voltar ao tamanho normal da letra" : "Aumentar a letra"}
      title={grande ? "Letra normal" : "Letra maior"}
      className={className}
    >
      <span aria-hidden className="text-[15px] leading-none font-bold">
        A{grande ? "−" : "+"}
      </span>
    </button>
  );
}
