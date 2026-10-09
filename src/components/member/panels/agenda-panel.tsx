"use client";

import { checkStatusInscricaoEvento, inscreverEmEvento } from "@/lib/actions/event-actions";
import { toggleAgendaReaction } from "@/lib/actions/reaction-actions";
import { votePoll } from "@/lib/actions/poll-actions";
import { EMOJIS_PERMITIDOS } from "@/lib/agenda-reactions";
import { mensagemErroAmigavel } from "@/lib/friendly-error";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import type { AgendaItem, AgendaReactionSummary } from "@/lib/member-data";
import { Check, Copy, Globe, GraduationCap, ListChecks, Loader2, MapPin, PartyPopper } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

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
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-na-gold-dark">
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

/**
 * Inscrição em evento pelo Portal — decisão do usuário 2026-09-30. Evento
 * gratuito: 1 clique, sem CPF. Evento pago: mesmo padrão de CPF + QR PIX
 * já usado no pagamento de contribuição, com polling até confirmar.
 */
function InscricaoEvento({
  memberId,
  eventId,
  price,
  inscricaoInicial,
}: {
  memberId: string;
  eventId: string;
  price: number;
  inscricaoInicial: Extract<AgendaItem, { kind: "evento" }>["minhaInscricao"];
}) {
  const [inscricao, setInscricao] = useState(inscricaoInicial);
  const [cpf, setCpf] = useState("");
  const [mostrarCpf, setMostrarCpf] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!inscricao || inscricao.pago) return;
    const intervalo = setInterval(async () => {
      const res = await checkStatusInscricaoEvento(memberId, inscricao.registrationId);
      if (res.status === "pago") {
        setInscricao((prev) => (prev ? { ...prev, pago: true } : prev));
        clearInterval(intervalo);
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [inscricao, memberId]);

  function handleInscrever(cpfLimpo?: string) {
    setErro(null);
    startTransition(async () => {
      try {
        const res = await inscreverEmEvento(memberId, eventId, cpfLimpo);
        setInscricao(
          res.pago
            ? { registrationId: res.registrationId ?? "", pago: true, pixPayload: null, pixQrCodeBase64: null }
            : { registrationId: res.registrationId, pago: false, pixPayload: res.pixPayload, pixQrCodeBase64: res.pixQrCodeBase64 },
        );
      } catch (e) {
        setErro(mensagemErroAmigavel(e));
      }
    });
  }

  function handleClickInscrever() {
    if (price > 0) {
      setMostrarCpf(true);
      return;
    }
    handleInscrever();
  }

  function handleConfirmarCpf(e: React.FormEvent) {
    e.preventDefault();
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      setErro("Digite um CPF válido (11 números).");
      return;
    }
    handleInscrever(cpfLimpo);
  }

  function handleCopiar() {
    if (!inscricao?.pixPayload) return;
    navigator.clipboard.writeText(inscricao.pixPayload).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  if (inscricao?.pago) {
    return <p className="mt-2 text-[11px] font-semibold text-na-green-dark dark:text-emerald-400">✓ Você está inscrito</p>;
  }

  if (inscricao?.pixQrCodeBase64) {
    return (
      <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
        {/* eslint-disable-next-line @next/next/no-img-element -- base64 dinâmico do Asaas */}
        <img src={`data:image/png;base64,${inscricao.pixQrCodeBase64}`} alt="QR Code PIX" className="h-40 w-40 rounded-lg border border-gray-200" />
        <button
          onClick={handleCopiar}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? "Copiado!" : "Copiar código PIX"}
        </button>
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          <Loader2 size={12} className="animate-spin" /> Aguardando confirmação...
        </p>
      </div>
    );
  }

  if (mostrarCpf) {
    return (
      <form onSubmit={handleConfirmarCpf} className="mt-2 flex flex-col gap-1.5">
        <input
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="CPF de quem vai pagar"
          inputMode="numeric"
          className="rounded-lg border border-gray-300 p-2 text-[12px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        {erro && <span className="text-[11px] text-red-700 dark:text-red-400">{erro}</span>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
        >
          {isPending ? "Gerando..." : "Gerar PIX"}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleClickInscrever}
        disabled={isPending}
        className="rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : "Inscrever-se"}
      </button>
      {erro && <p className="mt-1 text-[11px] text-red-700 dark:text-red-400">{erro}</p>}
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
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-na-gold-dark">
              {item.scope === "filial" ? (
                <>
                  <PartyPopper size={14} /> EVENTO DA ESCOLA
                </>
              ) : (
                <>
                  <Globe size={14} /> EVENTO {item.scope === "nacional" ? "NACIONAL" : "REGIONAL"}
                </>
              )}
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</div>
            <div className="mt-1 text-[11px] capitalize text-gray-500 dark:text-gray-400">
              {item.allDay ? formatDateBR(item.date) : formatDateTimeBR(item.date)}
            </div>
            {item.location && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <MapPin size={11} className="shrink-0" /> {item.location}
              </div>
            )}
            {item.description && <p className="mt-1.5 text-[12px] text-gray-600 dark:text-gray-300">{item.description}</p>}
            {item.scope === "filial" && (
              <>
                <div className="mt-2 text-xs font-bold text-na-green dark:text-emerald-400">
                  {item.price > 0 ? formatBRL(item.price) : "Entrada Gratuita"}
                </div>
                <InscricaoEvento memberId={memberId} eventId={item.id} price={item.price} inscricaoInicial={item.minhaInscricao} />
              </>
            )}
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
