"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { definirAreaDeTrabalho } from "@/lib/actions/acesso-voluntario-actions";

const AREAS = [
  ["escolastica", "Escolástica"],
  ["economia", "Economia"],
  ["eventos", "Eventos"],
  ["cafe", "Café"],
] as const;
type Area = (typeof AREAS)[number][0];

/**
 * Áreas de trabalho de uma pessoa na tela Liberar acessos (09/11/2026): quem chefia a filial dela liga ou desliga cada
 * área (vira responsável pela secretaria da área no Portal). Área que vem da função no Mercúrio aparece fixa.
 */
export function AreasDaPessoa({ pessoaId, porSecretaria, porFuncao, porDirecao = false }: { pessoaId: string; porSecretaria: string[]; porFuncao: string[]; porDirecao?: boolean }) {
  const [ativas, setAtivas] = useState(() => new Set(porSecretaria));
  const [emAndamento, setEmAndamento] = useState<Area | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" aria-label="Áreas de trabalho">
      <span className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">Áreas</span>
      {AREAS.map(([area, rotulo]) => {
        const fixa = porDirecao || porFuncao.includes(area);
        const ligada = fixa || ativas.has(area);
        return (
          <button
            key={area}
            type="button"
            disabled={fixa || emAndamento !== null}
            aria-pressed={ligada}
            title={porDirecao ? "Pela direção da filial" : fixa ? "Pela função no Mercúrio" : ligada ? `Tirar a área de ${rotulo}` : `Dar a área de ${rotulo}`}
            onClick={() => {
              setErro(null);
              setEmAndamento(area);
              iniciar(async () => {
                const r = await definirAreaDeTrabalho(pessoaId, area, !ligada);
                setEmAndamento(null);
                if (!r.ok) return setErro(r.error);
                setAtivas((atual) => {
                  const novo = new Set(atual);
                  if (ligada) novo.delete(area);
                  else novo.add(area);
                  return novo;
                });
              });
            }}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition disabled:cursor-default ${
              ligada
                ? "border-na-green bg-na-green/10 text-na-green-dark dark:border-emerald-700 dark:text-emerald-300"
                : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            } ${fixa ? "opacity-80" : ""}`}
          >
            {emAndamento === area && <Loader2 size={10} className="animate-spin" />}
            {rotulo}
            {fixa && <span className="font-normal"> · {porDirecao ? "direção" : "função"}</span>}
          </button>
        );
      })}
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </div>
  );
}
