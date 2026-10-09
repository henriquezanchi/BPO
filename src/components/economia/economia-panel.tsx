"use client";

import {
  aprovarSolicitacaoComposicao,
  getCrescimentoContribuicoes,
  getSolicitacoesComposicaoPendentes,
  rejeitarSolicitacaoComposicao,
} from "@/lib/actions/economia-actions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { Check, Loader2, Minus, Plus, TrendingUp, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

type Solicitacao = Awaited<ReturnType<typeof getSolicitacoesComposicaoPendentes>>[number];
type Crescimento = Awaited<ReturnType<typeof getCrescimentoContribuicoes>>;

const NOMES_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Mês atual e anterior, em UTC (mesma convenção usada no resto do projeto). */
function mesAtualEAnterior(): [{ ano: number; mes: number }, { ano: number; mes: number }] {
  const hoje = new Date();
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth() + 1;
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  return [{ ano, mes }, anterior];
}

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
  const [crescimentoAtual, setCrescimentoAtual] = useState<Crescimento | null>(null);
  const [crescimentoAnterior, setCrescimentoAnterior] = useState<Crescimento | null>(null);
  const [isPending, startTransition] = useTransition();

  function recarregar() {
    getSolicitacoesComposicaoPendentes(schoolId).then(setSolicitacoes);
  }

  useEffect(() => {
    recarregar();
    const [atual, anterior] = mesAtualEAnterior();
    getCrescimentoContribuicoes(schoolId, atual.ano, atual.mes).then(setCrescimentoAtual);
    getCrescimentoContribuicoes(schoolId, anterior.ano, anterior.mes).then(setCrescimentoAnterior);
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
      {crescimentoAtual && (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-gray-900 dark:text-gray-100">
            <TrendingUp size={14} className="text-na-green-dark" /> Crescimento de {NOMES_MES[crescimentoAtual.mes - 1]}
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Novas rubricas/doações</p>
              <p className="font-semibold text-na-green-dark dark:text-emerald-400">{formatBRL(crescimentoAtual.crescimentoComposicao)}/mês</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Reversão de inadimplência</p>
              <p className="font-semibold text-na-green-dark dark:text-emerald-400">{formatBRL(crescimentoAtual.reversaoInadimplencia)}</p>
            </div>
          </div>
          {crescimentoAnterior && (
            <p className="mt-2 text-[10px] text-gray-400">
              Em {NOMES_MES[crescimentoAnterior.mes - 1]}: {formatBRL(crescimentoAnterior.crescimentoComposicao)}/mês em rubricas/doações, {formatBRL(crescimentoAnterior.reversaoInadimplencia)} em reversão de inadimplência.
            </p>
          )}
        </div>
      )}

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
                className="rounded-xl border border-na-warning/30 bg-na-warning-light p-3 text-[13px] dark:border-amber-900 dark:bg-amber-950/30"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{s.member.name}</p>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      ehRemocao ? "bg-na-danger-light text-na-danger-dark dark:bg-red-950/40 dark:text-red-400" : "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-400"
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
