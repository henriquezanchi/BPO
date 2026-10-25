import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Seção recolhível em cartão (pedido do usuário 2026-10-25: telas menos "sem graça"): ícone, título e uma
 * linha dizendo o que tem dentro; fechada por padrão. Mesmo desenho do "Novo evento interno".
 */
export function CartaoSecao({ icone: Icone, titulo, descricao, children, aberto = false }: { icone: LucideIcon; titulo: string; descricao?: string; children: ReactNode; aberto?: boolean }) {
  return (
    <details open={aberto} className="group rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icone size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-gray-900 dark:text-gray-100">{titulo}</span>
          {descricao && <span className="block text-[12px] text-gray-500 dark:text-gray-400">{descricao}</span>}
        </span>
        <ChevronDown size={18} className="shrink-0 text-gray-400 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">{children}</div>
    </details>
  );
}
