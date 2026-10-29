"use client";

import { definirLeituraGaf } from "@/lib/actions/gaf-leituras-actions";
import { ETAPAS_GAF, rotuloTexto, SEM_LEITURA, TEXTOS_GAF, type TextoGaf } from "@/lib/gaf-leituras";
import { BookOpenText, ExternalLink, Loader2, Pencil, Trash2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

type Item = { id: string; startsAt: string; passado: boolean; origem: "escolhida" | "automatica" | "sem_leitura" | "a_definir"; texto: TextoGaf | null; escolha: string | null };

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ORIGEM: Record<Item["origem"], string> = { escolhida: "escolhido", automatica: "na sequência", sem_leitura: "sem leitura", a_definir: "a definir" };
const BIMESTRES = [...new Set(TEXTOS_GAF.map((t) => t.bimestre))];
const BOTAO = "inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

/**
 * Leituras do GAF (pedido do usuário 2026-10-26), na aba Encontros: o texto de cada encontro com o link para ler no
 * site do GAF. A coordenação escolhe o texto (ou "sem leitura"); os encontros seguintes seguem o cronograma sozinhos.
 */
export function LeiturasGaf({ itens, podeGerir, recarregar }: { itens: Item[]; podeGerir: boolean; recarregar: () => void }) {
  const [salvando, setSalvando] = useState<string | null>(null);
  // Mudar/excluir o texto de um encontro com botões (pedido do usuário 2026-10-29); a lista só abre ao tocar em "Mudar".
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const etapa = ETAPAS_GAF.teseu;
  const semNenhum = !itens.some((i) => i.texto);

  function escolher(id: string, valor: string) {
    setErro(null);
    setSalvando(id);
    iniciar(async () => {
      const r = await definirLeituraGaf(id, valor === "" ? null : valor);
      setSalvando(null);
      setEditando(null);
      if (!r.ok) setErro(r.error);
      else recarregar();
    });
  }

  if (!itens.length) return null;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
          <BookOpenText size={15} /> Leituras dos encontros
        </h2>
        <a href={etapa.pagina} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">
          Cronograma da Etapa {etapa.nome} <ExternalLink size={12} />
        </a>
      </div>
      {podeGerir && (
        <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
          {semNenhum
            ? "Escolha o texto do primeiro encontro: os seguintes seguem o cronograma sozinhos. Dá para mudar qualquer encontro."
            : "Os encontros seguem o cronograma a partir do último texto escolhido. Mude um encontro e a sequência recomeça dali."}
        </p>
      )}
      <ul className="mt-3 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {itens.map((i) => (
          <li key={i.id} className={`flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${i.passado ? "opacity-70" : ""}`}>
            <span className="w-32 shrink-0 text-[12px] font-semibold text-gray-600 capitalize dark:text-gray-300">{quando(i.startsAt)}</span>
            <span className="min-w-0 flex-1">
              {i.texto ? (
                <a href={i.texto.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1 text-[13px] font-semibold text-gray-900 hover:text-na-green-dark dark:text-gray-100 dark:hover:text-emerald-400">
                  <span>{rotuloTexto(i.texto)}</span>
                  <ExternalLink size={12} className="mt-1 shrink-0 text-gray-400 group-hover:text-na-green-dark" />
                </a>
              ) : (
                <span className="text-[13px] text-gray-500 dark:text-gray-400">{i.origem === "sem_leitura" ? "Sem leitura neste encontro" : "Texto a definir"}</span>
              )}
              {podeGerir && i.texto && <span className="ml-2 text-[11px] text-gray-400">{ORIGEM[i.origem]}</span>}
            </span>
            {podeGerir && editando !== i.id && (
              <span className="flex items-center gap-1.5">
                {salvando === i.id && <Loader2 size={13} className="animate-spin text-gray-400" />}
                <button type="button" disabled={salvando !== null} onClick={() => setEditando(i.id)} className={BOTAO}>
                  <Pencil size={12} /> {i.texto ? "Mudar" : "Escolher"}
                </button>
                {i.origem === "sem_leitura" ? (
                  <button type="button" disabled={salvando !== null} onClick={() => escolher(i.id, "")} className={BOTAO} title="Volta a seguir o cronograma">
                    <Undo2 size={12} /> Voltar ao cronograma
                  </button>
                ) : (
                  i.texto && (
                    <button type="button" disabled={salvando !== null} onClick={() => escolher(i.id, SEM_LEITURA)} className={`${BOTAO} text-na-danger-dark dark:text-red-300`} title="Este encontro fica sem leitura">
                      <Trash2 size={12} /> Excluir
                    </button>
                  )
                )}
              </span>
            )}
            {podeGerir && editando === i.id && (
              <span className="flex items-center gap-2">
                {salvando === i.id && <Loader2 size={13} className="animate-spin text-gray-400" />}
                <select
                  autoFocus
                  aria-label={`Texto do encontro de ${quando(i.startsAt)}`}
                  value={i.escolha ?? ""}
                  disabled={salvando !== null}
                  onChange={(e) => escolher(i.id, e.target.value)}
                  className="max-w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-[12px] text-gray-900 sm:w-56 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Automático (sequência)</option>
                  <option value={SEM_LEITURA}>Sem leitura neste encontro</option>
                  {BIMESTRES.map((b) => (
                    <optgroup key={b} label={`${b}º bimestre`}>
                      {TEXTOS_GAF.filter((t) => t.bimestre === b).map((t) => (
                        <option key={t.codigo} value={t.codigo}>
                          {rotuloTexto(t)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button type="button" onClick={() => setEditando(null)} className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Cancelar
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {erro && <p className="mt-2 text-[12px] text-na-danger-dark dark:text-red-400">{erro}</p>}
    </section>
  );
}
