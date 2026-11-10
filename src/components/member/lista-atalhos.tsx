"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Lista de atalhos do Portal do Aluno (avaliação de design, 10/11/2026): o mesmo formato de linha na página inicial e nas
 * janelas (Estudos, Pagamentos...), para não misturar botões de tamanhos e cores diferentes.
 */
/** Lista agrupada de atalhos secundários (Comunidade, Ajuda e escola). */
export function ListaAtalhos({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-1.5">
      <h2 className="px-1 text-[12px] font-bold text-gray-600 dark:text-gray-300">{titulo}</h2>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">{children}</ul>
    </section>
  );
}

export function LinhaAtalho({ icon, title, subtitle, onClick, href, externo, selo }: { icon: ReactNode; title: string; subtitle: string; onClick?: () => void; href?: string; externo?: boolean; selo?: string }) {
  const corpo = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-na-green-light text-na-green dark:bg-emerald-900/40 dark:text-emerald-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">{title}</span>
        <span className="block truncate text-[12px] text-gray-600 dark:text-gray-400">{subtitle}</span>
      </span>
      {selo && <span className="shrink-0 rounded-full bg-na-gold/25 px-2 py-0.5 text-[11px] font-bold text-na-gold-dark dark:bg-amber-950/50 dark:text-amber-300">{selo}</span>}
      <ChevronRight size={16} className="shrink-0 text-gray-400" aria-hidden />
    </>
  );
  const classe = "flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60";
  return (
    <li>
      {href && externo ? (
        <a href={href} target="_blank" rel="noreferrer" className={classe}>
          {corpo}
        </a>
      ) : href ? (
        <Link href={href} className={classe}>
          {corpo}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={classe}>
          {corpo}
        </button>
      )}
    </li>
  );
}
