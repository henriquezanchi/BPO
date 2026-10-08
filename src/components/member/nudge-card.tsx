"use client";

import { getNudgeAtivo, responderNudge } from "@/lib/actions/nudge-actions";
import { HeartHandshake, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * Sugestão de contribuição extra (crédito Fortuna recorrente, doação
 * Biblioteca, Criança pelo Bem) — pedido do usuário 2026-10-08: "estimular
 * sem ser inconveniente". Só UMA sugestão por vez (ver getNudgeAtivo), e
 * some assim que respondida (sim/depois/não) ou aceita por outro caminho
 * (ex: membro já incluiu o item manualmente).
 */
export function NudgeCard({ memberId }: { memberId: string }) {
  const [nudge, setNudge] = useState<Awaited<ReturnType<typeof getNudgeAtivo>>>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getNudgeAtivo(memberId).then(setNudge);
  }, [memberId]);

  function responder(resposta: "sim" | "depois" | "nao", valor?: number) {
    if (!nudge) return;
    startTransition(async () => {
      await responderNudge(memberId, nudge.id, resposta, valor);
      setNudge(null);
    });
  }

  if (!nudge) return null;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-na-gold/40 bg-na-gold/10 p-4">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-na-gold/20 text-na-gold-dark">
          <HeartHandshake size={16} />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{nudge.titulo}</h3>
          <p className="text-[12px] text-gray-600 dark:text-gray-400">{nudge.descricao}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {nudge.opcoes.map((opcao) => (
          <button
            key={opcao.label}
            onClick={() => responder("sim", opcao.valor)}
            disabled={isPending}
            className="rounded-lg bg-na-green px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : nudge.opcoes.length === 1 ? "Sim" : opcao.label}
          </button>
        ))}
        <button
          onClick={() => responder("depois")}
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Lembrar mês que vem
        </button>
        <button
          onClick={() => responder("nao")}
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Não
        </button>
      </div>
    </div>
  );
}
