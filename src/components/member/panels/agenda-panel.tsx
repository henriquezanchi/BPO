"use client";

import { checkStatusInscricaoEvento, inscreverEmEvento } from "@/lib/actions/event-actions";
import { votePoll } from "@/lib/actions/poll-actions";
import { mensagemErroAmigavel } from "@/lib/friendly-error";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import type { AgendaItem } from "@/lib/member-data";
import { Check, ChevronLeft, ChevronRight, Copy, Globe, GraduationCap, ListChecks, Loader2, MapPin, PartyPopper } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

const ACTIVITY_LABEL: Record<string, string> = {
  prova: "Prova",
  trabalho: "Trabalho",
  leitura: "Leitura",
  atividade_turma: "Atividade de turma",
};

const MESES_NOME = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Chave local "aaaa-mm-dd" — agrupa por dia no fuso do navegador, igual ao que formatDateTimeBR já mostra. */
function chaveDia(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const COR_PONTO: Record<AgendaItem["kind"], string> = {
  evento: "bg-na-gold",
  atividade: "bg-na-green",
  enquete: "bg-na-turquesa",
};

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
      <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-na-warning/30 bg-na-warning-light p-3 dark:border-amber-900 dark:bg-amber-950/30">
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
        {erro && <span className="text-[11px] text-na-danger-dark dark:text-red-400">{erro}</span>}
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
      {erro && <p className="mt-1 text-[11px] text-na-danger-dark dark:text-red-400">{erro}</p>}
    </div>
  );
}

function ItemCard({ memberId, item }: { memberId: string; item: AgendaItem }) {
  if (item.kind === "enquete") return <PollCard memberId={memberId} item={item} />;

  if (item.kind === "evento") {
    return (
      <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
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
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-na-green/30 bg-na-green-light/40 p-3 dark:bg-emerald-950/20">
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
      {item.description && <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">{item.description}</p>}
    </div>
  );
}

function itemKey(item: AgendaItem) {
  return `${item.kind}-${item.id}`;
}

export function AgendaPanel({ memberId, items }: { memberId: string; items: AgendaItem[] }) {
  const porDia = useMemo(() => {
    const mapa = new Map<string, AgendaItem[]>();
    for (const item of items) {
      const chave = chaveDia(item.date);
      const lista = mapa.get(chave);
      if (lista) lista.push(item);
      else mapa.set(chave, [item]);
    }
    return mapa;
  }, [items]);

  const hoje = useMemo(() => new Date(), []);

  // Abre direto no 1º dia com algo agendado (hoje, se tiver; senão o próximo
  // item futuro) — evita abrir a agenda numa data vazia sem o membro saber
  // pra onde navegar. O mês exibido acompanha esse mesmo dia.
  const [diaSelecionado, setDiaSelecionado] = useState(() => (items.length > 0 ? items[0].date : hoje));
  const [mesExibido, setMesExibido] = useState(() => new Date(diaSelecionado.getFullYear(), diaSelecionado.getMonth(), 1));

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
        Nenhum evento ou atividade agendada no momento.
      </p>
    );
  }

  const ano = mesExibido.getFullYear();
  const mes = mesExibido.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas: (Date | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => new Date(ano, mes, i + 1)),
  ];

  const itensDoDiaSelecionado = porDia.get(chaveDia(diaSelecionado)) ?? [];

  function mudarMes(delta: number) {
    setMesExibido(new Date(ano, mes + delta, 1));
  }

  function selecionarDia(dia: Date) {
    setDiaSelecionado(dia);
    if (dia.getMonth() !== mes || dia.getFullYear() !== ano) setMesExibido(new Date(dia.getFullYear(), dia.getMonth(), 1));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => mudarMes(-1)}
            aria-label="Mês anterior"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">
            {MESES_NOME[mes]} {ano}
          </span>
          <button
            onClick={() => mudarMes(1)}
            aria-label="Próximo mês"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500">
          {DIAS_SEMANA.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {celulas.map((dia, i) => {
            if (!dia) return <div key={`vazio-${i}`} />;
            const itensDoDia = porDia.get(chaveDia(dia)) ?? [];
            const ehHoje = chaveDia(dia) === chaveDia(hoje);
            const ehSelecionado = chaveDia(dia) === chaveDia(diaSelecionado);
            const tiposPresentes = [...new Set(itensDoDia.map((it) => it.kind))];
            return (
              <button
                key={chaveDia(dia)}
                onClick={() => selecionarDia(dia)}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[12px] transition ${
                  ehSelecionado
                    ? "bg-na-green text-white font-semibold"
                    : ehHoje
                      ? "border border-na-green text-na-green-dark dark:text-emerald-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {dia.getDate()}
                <span className="flex h-2.5 items-center gap-0.5">
                  {tiposPresentes.map((tipo) => (
                    <span
                      key={tipo}
                      className={`h-1 w-1 rounded-full ${ehSelecionado ? "bg-white" : COR_PONTO[tipo]}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {itensDoDiaSelecionado.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-gray-500 dark:text-gray-400">
            Nada agendado para {formatDateBR(diaSelecionado)}.
          </p>
        ) : (
          itensDoDiaSelecionado.map((item) => <ItemCard key={itemKey(item)} memberId={memberId} item={item} />)
        )}
      </div>
    </div>
  );
}
