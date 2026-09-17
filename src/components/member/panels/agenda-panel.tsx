"use client";

import { toggleAgendaReaction } from "@/lib/actions/reaction-actions";
import { votePoll } from "@/lib/actions/poll-actions";
import { EMOJIS_PERMITIDOS } from "@/lib/agenda-reactions";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import type { AgendaItem, AgendaReactionSummary } from "@/lib/member-data";
import { GraduationCap, ListChecks, PartyPopper } from "lucide-react";
import { useState, useTransition } from "react";

const ACTIVITY_LABEL: Record<string, string> = {
  prova: "Prova",
  trabalho: "Trabalho",
  leitura: "Leitura",
  atividade_turma: "Atividade de turma",
};

/**
 * Reações de emoji num card da Agenda — visíveis pros outros alunos
 * (contagem agregada, sem expor quem reagiu). Sem tempo real: a
 * atualização de quem reagiu depois de você só aparece quando o Portal
 * recarregar (ver toggleAgendaReaction), não instantaneamente.
 */
function ReactionBar({
  memberId,
  itemType,
  itemId,
  reactions,
}: {
  memberId: string;
  itemType: "evento" | "atividade";
  itemId: string;
  reactions: AgendaReactionSummary[];
}) {
  const [local, setLocal] = useState(reactions);
  const [isPending, startTransition] = useTransition();

  function handleClick(emoji: string) {
    startTransition(async () => {
      const res = await toggleAgendaReaction(memberId, itemType, itemId, emoji);
      setLocal((prev) => {
        const semEsse = prev.filter((r) => r.emoji !== emoji);
        const count = res.counts[emoji] ?? 0;
        return count > 0 ? [...semEsse, { emoji, count, reactedByMe: res.reactedByMe }] : semEsse;
      });
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {EMOJIS_PERMITIDOS.map((emoji) => {
        const registro = local.find((r) => r.emoji === emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleClick(emoji)}
            disabled={isPending}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition disabled:opacity-60 ${
              registro?.reactedByMe
                ? "border-na-green bg-na-green-light dark:border-emerald-700 dark:bg-emerald-950/40"
                : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            }`}
          >
            <span>{emoji}</span>
            {registro && registro.count > 0 && <span className="text-gray-500 dark:text-gray-400">{registro.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Enquete criada pelo professor (ver createPoll) — o resultado (barra e %)
 * só aparece depois que o próprio aluno vota, pra não influenciar quem
 * ainda não respondeu.
 */
function PollCard({ memberId, item }: { memberId: string; item: Extract<AgendaItem, { kind: "enquete" }> }) {
  const [options, setOptions] = useState(item.options);
  const [myVote, setMyVote] = useState(item.myVote);
  const [isPending, startTransition] = useTransition();

  function handleVote(optionId: string) {
    startTransition(async () => {
      const res = await votePoll(memberId, item.id, optionId);
      setMyVote(res.myOptionId);
      setOptions((prev) => prev.map((o) => ({ ...o, votes: res.counts[o.id] ?? 0 })));
    });
  }

  const total = options.reduce((soma, o) => soma + o.votes, 0);

  return (
    <div className="rounded-xl border border-na-gold/30 bg-na-gold/5 p-3 dark:bg-na-gold/10">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-na-gold">
        <ListChecks size={14} /> ENQUETE · {item.className}
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.question}</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {options.map((o) => {
          const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
          const selecionada = myVote === o.id;
          return (
            <button
              key={o.id}
              onClick={() => handleVote(o.id)}
              disabled={isPending}
              className={`relative overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition disabled:opacity-60 ${
                selecionada ? "border-na-green" : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {myVote && (
                <div className="absolute inset-y-0 left-0 bg-na-green-light dark:bg-emerald-950/40" style={{ width: `${pct}%` }} />
              )}
              <div className="relative flex items-center justify-between">
                <span className={selecionada ? "font-semibold text-na-green-dark dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"}>
                  {o.label}
                </span>
                {myVote && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {pct}% ({o.votes})
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AgendaPanel({ memberId, items }: { memberId: string; items: AgendaItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
        Nenhum evento ou atividade agendada no momento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) =>
        item.kind === "enquete" ? (
          <PollCard key={`enquete-${item.id}`} memberId={memberId} item={item} />
        ) : item.kind === "evento" ? (
          <div
            key={`evento-${item.id}`}
            className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
          >
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-na-gold">
              <PartyPopper size={14} /> EVENTO DA ESCOLA
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</div>
            <div className="mt-1 text-[11px] capitalize text-gray-500 dark:text-gray-400">{formatDateTimeBR(item.date)}</div>
            <div className="mt-2 text-xs font-bold text-na-green dark:text-emerald-400">
              {item.price > 0 ? formatBRL(item.price) : "Entrada Gratuita"}
            </div>
            <ReactionBar memberId={memberId} itemType="evento" itemId={item.id} reactions={item.reactions} />
          </div>
        ) : (
          <div
            key={`atividade-${item.id}`}
            className="rounded-xl border border-na-green/30 bg-na-green-light/40 p-3 dark:bg-emerald-950/20"
          >
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-na-green-dark dark:text-emerald-400">
              <GraduationCap size={14} /> {ACTIVITY_LABEL[item.type] ?? item.type} · {item.className}
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</div>
            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Data: {formatDateTimeBR(item.date)}</div>
            {item.studyItems && (
              <div className="mt-2 rounded-lg bg-white p-2 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <span className="font-semibold">Conteúdo a estudar: </span>
                {item.studyItems}
              </div>
            )}
            {item.description && (
              <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">{item.description}</p>
            )}
            <ReactionBar memberId={memberId} itemType="atividade" itemId={item.id} reactions={item.reactions} />
          </div>
        ),
      )}
    </div>
  );
}
