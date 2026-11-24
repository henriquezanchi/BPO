"use client";

import { sugestoesDoRepertorio } from "@/lib/actions/repertorio-actions";
import { rotuloRequisito, rotuloTipo } from "@/lib/repertorio";
import { Music } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Sugestões do repertório da Secretaria de Artes no cadastro de eventos (24/11/2026): quem já tem número pronto, o
 * que cada um precisa no local e o formato simplificado, para a direção avaliar o que cabe no evento.
 */
export function SugestoesRepertorio({ schoolId }: { schoolId: string }) {
  const [lista, setLista] = useState<Awaited<ReturnType<typeof sugestoesDoRepertorio>> | null>(null);
  useEffect(() => { sugestoesDoRepertorio(schoolId).then(setLista).catch(() => setLista([])); }, [schoolId]);
  if (!lista || lista.length === 0) return null;
  const dataBR = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : null);
  return (
    <details className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[12px] dark:border-gray-700 dark:bg-gray-800/40">
      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-100"><Music size={13} /> Repertório da Secretaria de Artes ({lista.reduce((s, a) => s + a.numeros.length, 0)} apresentações)</summary>
      <p className="mt-1 text-gray-500 dark:text-gray-400">Quem já tem número pronto e o que cada um precisa. Combine com a Secretaria de Artes.</p>
      <ul className="mt-2 flex flex-col gap-2">
        {lista.map((a) => (
          <li key={a.artista}>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{a.artista}</p>
            <ul className="ml-3 list-disc text-gray-700 dark:text-gray-300">
              {a.numeros.map((n, i) => (
                <li key={i}>
                  {n.titulo} <span className="text-gray-500">· {rotuloTipo(n.tipo)}{n.duracaoMin ? ` · ${n.duracaoMin} min` : ""}{n.apresentadoEm ? ` · ${dataBR(n.apresentadoEm)}` : ""}</span>
                  {(n.requisitos.length > 0 || n.requisitosOutros) && <span className="block text-gray-500">Precisa: {[...n.requisitos.map(rotuloRequisito), n.requisitosOutros].filter(Boolean).join(", ")}</span>}
                  {n.formatoSimplificado && <span className="block text-na-green-dark dark:text-emerald-400">Formato simples: {n.formatoSimplificado}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}
