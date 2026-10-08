"use client";

import { aprovarSolicitacaoComposicao, getSolicitacoesComposicaoPendentes, rejeitarSolicitacaoComposicao } from "@/lib/actions/economia-actions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { Check, Loader2, Minus, Plus, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

type Solicitacao = Awaited<ReturnType<typeof getSolicitacoesComposicaoPendentes>>[number];

/**
 * Fila de aprovação do Secretário de Economia (ou Direção, enquanto ninguém
 * tiver esse cargo no Mercúrio — ver requireEconomiaOuDirecao). Regra do
 * usuário 2026-10-08: qualquer coisa que AUMENTA o quanto o membro paga à
 * escola aplica direto (não passa mais por aqui, nunca fica "pendente") — só
 * remoção de item que a ESCOLA lançou direto no Mercúrio (!addedViaPortal)
 * continua precisando de aprovação, porque diminui o que a escola recebe e
 * não é self-service (diferente de remover um item que o próprio membro
 * incluiu). Aprovar apaga o item de verdade + propaga pro Mercúrio; rejeitar
 * não aplica nada.
 */
export function EconomiaPanel({ schoolId }: { schoolId: string }) {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function recarregar() {
    getSolicitacoesComposicaoPendentes(schoolId).then(setSolicitacoes);
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  function handleAprovar(id: string) {
    startTransition(async () => {
      await aprovarSolicitacaoComposicao(schoolId, id);
      recarregar();
    });
  }

  function handleRejeitar(id: string) {
    startTransition(async () => {
      await rejeitarSolicitacaoComposicao(schoolId, id);
      recarregar();
    });
  }

  if (!solicitacoes) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        Solicitações de remoção de item de composição ({solicitacoes.length})
      </p>
      {solicitacoes.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma solicitação pendente.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {solicitacoes.map((s) => {
            const ehRemocao = s.tipo === "remocao";
            return (
              <div
                key={s.id}
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] dark:border-amber-900 dark:bg-amber-950/30"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{s.member.name}</p>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      ehRemocao ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    }`}
                  >
                    {ehRemocao ? <Minus size={10} /> : <Plus size={10} />}
                    {ehRemocao ? "Remover" : "Incluir"}
                  </span>
                </div>
                <p className="mt-1 flex justify-between text-[12px] text-gray-700 dark:text-gray-300">
                  <span>{s.label}</span>
                  <span className="font-semibold">{formatBRL(s.amount)}/mês</span>
                </p>
                <p className="mt-1 text-[10px] text-gray-400">Solicitado em {formatDateBR(s.createdAt)}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleAprovar(s.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-na-green px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
                  >
                    <Check size={12} /> Aprovar
                  </button>
                  <button
                    onClick={() => handleRejeitar(s.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <X size={12} /> Rejeitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
