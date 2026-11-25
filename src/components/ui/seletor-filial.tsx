"use client";

import { FaixaRolavel } from "@/components/ui/faixa-rolavel";
import Link from "next/link";

/**
 * Troca de filial para quem enxerga várias (dono do sistema, nacional). No celular, 20 chips quebrando em 7 linhas
 * empurravam o conteúdo para baixo da dobra (revisão de design 25/11/2026); agora é uma faixa de uma linha, com a
 * filial atual centralizada e setas quando há mais escondido.
 */
export function SeletorFilial({ escolas, atual, base, className = "" }: { escolas: { id: string; name: string }[]; atual: string; /** Endereço da página sem o parâmetro `filial` (ex.: "/economia?aba=x"). */ base: string; className?: string }) {
  const href = (id: string) => `${base}${base.includes("?") ? "&" : "?"}filial=${id}`;
  return (
    <FaixaRolavel aria-label="Filial" role="navigation" externo={className} className="flex gap-1.5 py-0.5">
      {escolas.map((e) => {
        const marcada = e.id === atual;
        return (
          <Link
            key={e.id}
            href={href(e.id)}
            aria-current={marcada ? "page" : undefined}
            className={`flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[12px] font-semibold whitespace-nowrap transition ${
              marcada ? "border-na-green bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "border-gray-300 text-gray-600 hover:border-na-green/50 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            {e.name.replace(/^Nova Acrópole\s*-\s*/i, "")}
          </Link>
        );
      })}
    </FaixaRolavel>
  );
}
