"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Faixa horizontal de abas ou filtros sem barra de rolagem (pedido do usuário 11/11/2026: "troque as barras de rolagem
 * por setas, mais elegantes"). Quando há conteúdo escondido de um lado, aparece uma seta sobre um esmaecido; no celular
 * o dedo continua arrastando. A aba atual (aria-current / aria-selected) entra na tela ao abrir.
 * `className` vai para a faixa que rola (as mesmas classes do antigo contêiner, sem overflow-x-auto).
 */
export function FaixaRolavel({
  children,
  className = "",
  externo = "",
  fundo = "from-na-bg dark:from-gray-950",
  ...aria
}: {
  children: ReactNode;
  className?: string;
  /** Classes do invólucro (margens negativas, borda inferior...). */
  externo?: string;
  /** Cor do esmaecido sob as setas: a do fundo da página. */
  fundo?: string;
  "aria-label"?: string;
  role?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [lados, setLados] = useState({ esquerda: false, direita: false });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setLados({ esquerda: el.scrollLeft > 4, direita: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const atual = el.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"], [aria-pressed="true"]');
    if (atual && (atual.offsetLeft < el.scrollLeft || atual.offsetLeft + atual.offsetWidth > el.scrollLeft + el.clientWidth))
      el.scrollLeft = atual.offsetLeft - el.clientWidth / 2 + atual.offsetWidth / 2;
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [medir]);

  const rolar = (sentido: 1 | -1) => ref.current?.scrollBy({ left: sentido * ref.current.clientWidth * 0.7, behavior: "smooth" });

  const seta = (lado: "esquerda" | "direita") => {
    const esq = lado === "esquerda";
    return (
      <div
        className={`pointer-events-none absolute inset-y-0 ${esq ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l"} ${fundo} flex w-14 items-center ${
          esq ? "justify-start" : "justify-end"
        } to-transparent transition-opacity duration-200 ${lados[lado] ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!lados[lado]}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => rolar(esq ? -1 : 1)}
          aria-label={esq ? "Ver anteriores" : "Ver mais"}
          className={`flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:text-na-green-dark dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:text-emerald-400 ${
            lados[lado] ? "pointer-events-auto" : ""
          }`}
        >
          {esq ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    );
  };

  return (
    <div className={`relative ${externo}`}>
      <div ref={ref} onScroll={medir} className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`} {...aria}>
        {children}
      </div>
      {seta("esquerda")}
      {seta("direita")}
    </div>
  );
}
