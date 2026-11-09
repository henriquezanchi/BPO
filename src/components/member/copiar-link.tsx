"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

/** Mostra um link e um botão de copiar (sem compartilhar): para links pessoais, como o da agenda. */
export function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <code className="block overflow-x-auto rounded-lg bg-gray-100 p-2 text-[11px] break-all text-gray-700 select-all dark:bg-gray-800 dark:text-gray-300">{link}</code>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(link).then(
            () => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1800);
            },
            () => {},
          )
        }
        className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      >
        <Copy size={15} /> {copiado ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
