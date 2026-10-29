"use client";

import { desistirDeAjudar, quererAjudar } from "@/lib/actions/oportunidades-actions";
import { quandoDaOportunidade } from "@/lib/oportunidades-comum";
import type { OportunidadeDoMembro } from "@/lib/oportunidades";
import { CalendarClock, CheckCircle2, Clock, HandHeart, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * Oportunidades de voluntariado da filial no quadro Voluntariado (pedido do usuário 2026-10-29): o membro vê o que
 * a escola precisa e se oferece; o responsável recebe e responde em /voluntario/oportunidades.
 */
export function OportunidadesMembro({ lista, aoMudar }: { lista: OportunidadeDoMembro[]; aoMudar: () => void }) {
  return (
    <ul className="mb-5 flex flex-col gap-2.5">
      {lista.map((op) => (
        <Cartao key={op.id} op={op} aoMudar={aoMudar} />
      ))}
    </ul>
  );
}

function Cartao({ op, aoMudar }: { op: OportunidadeDoMembro; aoMudar: () => void }) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [recado, setRecado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function agir(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setErro(r.error ?? "Não foi possível concluir.");
      setEscrevendo(false);
      setRecado("");
      aoMudar();
    });
  }

  const podeOferecer = op.aberta && !op.lotada && (op.meuStatus === null || op.meuStatus === "desistiu");
  const botao = "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition disabled:opacity-60";

  return (
    <li className="rounded-2xl border border-gray-200 p-3.5 dark:border-gray-800">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">
        <span>{op.area}</span>
        <span className="flex items-center gap-1 font-semibold tracking-normal text-gray-500 normal-case dark:text-gray-400">
          {op.tipo === "pontual" ? <CalendarClock size={11} /> : <Clock size={11} />}
          {quandoDaOportunidade(op)}
        </span>
      </p>
      <h4 className="mt-1 text-[14px] leading-snug font-bold text-gray-900 dark:text-gray-100">{op.titulo}</h4>
      <p className="mt-1 text-[12px] leading-relaxed whitespace-pre-line text-gray-600 dark:text-gray-400">{op.descricao}</p>
      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        Com {op.responsavel}
        {op.vagas != null && ` · ${op.aceitos} de ${op.vagas} ${op.vagas === 1 ? "vaga preenchida" : "vagas preenchidas"}`}
      </p>

      <div className="mt-2.5">
        {op.meuStatus === "pendente" && (
          <Situacao texto="Você se ofereceu. Aguardando a resposta." acao="Desfazer" pendente={isPending} onClick={() => agir(() => desistirDeAjudar(op.id))} />
        )}
        {op.meuStatus === "aceito" && (
          <Situacao verde texto="Você está participando. Obrigado!" acao="Não poderei mais" pendente={isPending} onClick={() => agir(() => desistirDeAjudar(op.id))} />
        )}
        {op.meuStatus === "recusado" && <p className="text-[12px] text-gray-500 dark:text-gray-400">Desta vez não foi preciso. Obrigado por se oferecer!</p>}
        {op.meuStatus !== "aceito" && op.meuStatus !== "pendente" && op.lotada && <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Vagas preenchidas.</p>}
        {podeOferecer &&
          (escrevendo ? (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                Quer deixar um recado? <span className="font-normal text-gray-400">(opcional)</span>
                <textarea
                  value={recado}
                  onChange={(e) => setRecado(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="Ex.: posso a partir das 19h"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] font-normal text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <div className="flex gap-2">
                <button disabled={isPending} onClick={() => agir(() => quererAjudar(op.id, recado))} className={`${botao} flex-1 bg-na-green text-white hover:bg-na-green-dark`}>
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <HandHeart size={14} />} Enviar
                </button>
                <button disabled={isPending} onClick={() => setEscrevendo(false)} className={`${botao} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEscrevendo(true)} className={`${botao} w-full bg-na-green text-white hover:bg-na-green-dark`}>
              <HandHeart size={14} /> Quero ajudar
            </button>
          ))}
        {erro && <p className="mt-1.5 text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      </div>
    </li>
  );
}

function Situacao({ texto, acao, onClick, pendente, verde }: { texto: string; acao: string; onClick: () => void; pendente: boolean; verde?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${verde ? "text-na-success-dark dark:text-emerald-300" : "text-gray-600 dark:text-gray-300"}`}>
        {verde ? <CheckCircle2 size={14} /> : <Clock size={14} />} {texto}
      </span>
      <button disabled={pendente} onClick={onClick} className="text-[11px] font-semibold text-gray-500 underline-offset-2 hover:underline disabled:opacity-60 dark:text-gray-400">
        {pendente ? "…" : acao}
      </button>
    </div>
  );
}
