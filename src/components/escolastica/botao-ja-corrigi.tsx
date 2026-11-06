"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { marcarAlertaCorrigido } from "@/lib/actions/alertas-cadastro-actions";

/** Ações de um item dos alertas de cadastro: copiar a matrícula (para buscar no Mercúrio) e "Já corrigi". */
export function AcoesDoAlerta({ schoolId, chave, matricula }: { schoolId: string; chave: string; matricula?: string }) {
  const [pendente, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const botao =
    "inline-flex min-h-8 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800";
  return (
    <span className="flex items-center gap-1.5">
      {matricula && (
        <button
          type="button"
          className={botao}
          aria-label={`Copiar a matrícula ${matricula}`}
          onClick={() => {
            navigator.clipboard?.writeText(matricula).then(
              () => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              },
              () => {},
            );
          }}
        >
          <Copy size={12} /> {copiado ? "Copiada" : "Matrícula"}
        </button>
      )}
      <button
        type="button"
        className={botao}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            try {
              await marcarAlertaCorrigido(schoolId, chave);
            } catch {
              setErro("Não deu certo. Tente de novo.");
            }
          })
        }
      >
        {pendente ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Já corrigi
      </button>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </span>
  );
}
