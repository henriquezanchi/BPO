import type { ReactNode } from "react";

/**
 * Seção recolhível. Abre por padrão (pedido do usuário 2026-10-25: "gavetas apenas para as encerradas ou
 * canceladas; as ativas aparecem sem gavetas"); passe defaultOpen={false} só para o que está encerrado/cancelado.
 */
export function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return <details open={defaultOpen} className="min-w-0">
    <summary className="cursor-pointer rounded-lg py-2 focus-visible:outline-2 focus-visible:outline-na-green [&>h2]:inline [&>h3]:inline">{title}</summary>
    <div className="flex min-w-0 flex-col gap-3 pt-3">{children}</div>
  </details>;
}
