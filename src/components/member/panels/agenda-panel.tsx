"use client";
import {REFUND_LABELS} from "@/lib/event-refund-policy";

import {usePaymentPolling} from "@/hooks/use-payment-polling";
import { CompartilharEvento } from "@/components/member/compartilhar-evento";
import { MeetingResponse } from "@/components/member/groups/meeting-response";
import { eventoCompartilhavel } from "@/lib/compartilhar-evento";
import { checkStatusInscricaoEvento, inscreverEmEvento } from "@/lib/actions/event-actions";
import { votePoll } from "@/lib/actions/poll-actions";
import { mensagemErroAmigavel } from "@/lib/friendly-error";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import type { AgendaItem } from "@/lib/member-data";
import { CalendarClock, Check, ChevronLeft, ChevronRight, Copy, Globe, GraduationCap, ListChecks, Loader2, MapPin, PartyPopper, Users, UtensilsCrossed } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

const ACTIVITY_LABEL: Record<string, string> = {
  prova: "Prova",
  trabalho: "Trabalho",
  leitura: "Leitura",
  atividade_turma: "Atividade de turma",
  aviso: "Aviso",
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
  reuniao: "bg-na-green",
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
  unavailableReason,
}: {
  memberId: string;
  eventId: string;
  price: number;
  unavailableReason?: string | null;
  inscricaoInicial: Extract<AgendaItem, { kind: "evento" }>["minhaInscricao"];
}) {
  const [inscricao, setInscricao] = useState(inscricaoInicial);
  const [cpf, setCpf] = useState("");
  const [mostrarCpf, setMostrarCpf] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const polling = usePaymentPolling(inscricao&&!inscricao.pago?inscricao.registrationId:null,
    ()=>checkStatusInscricaoEvento(memberId,inscricao!.registrationId),
    result=>{if(result.status!=="pago")return false;setInscricao(previous=>previous?{...previous,pago:true}:previous);return true;});

  function handleInscrever(cpfLimpo?: string) {
    setErro(null);
    startTransition(async () => {
      try {
        const res = await inscreverEmEvento(memberId, eventId, cpfLimpo);
        if(!res.ok){setErro(res.error);return;}
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
        {(polling.state==="error"||polling.state==="paused")&&<div className="text-xs"><p>A consulta foi pausada. Sua inscrição continua salva.</p><button onClick={polling.retry} className="mt-2 rounded-lg border px-3 py-2">Consultar pagamento novamente</button></div>}
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          <Loader2 size={12} className="animate-spin" /> Aguardando confirmação...
        </p>
      </div>
    );
  }

  if(unavailableReason)return <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">{unavailableReason}</p>;

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

function ItemCard({ memberId, item, somenteConsulta, emBreve }: { memberId: string; item: AgendaItem; somenteConsulta?: boolean; emBreve?: boolean }) {
  if (item.kind === 'reuniao') return <section className="space-y-2 rounded-xl border border-na-green/30 p-4 text-sm">
    <p className="font-semibold text-na-green-dark dark:text-na-green-light">{item.className} · Convocação</p><h3 className="font-bold">{item.title}</h3><p>{item.date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})} — {item.endsAt.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</p>
    {item.status==='cancelada'?<p>Reunião cancelada: {item.cancellationReason}</p>:<><p>Comparecimento obrigatório. Se não puder participar, registre uma justificativa.</p>{item.fullUniform&&<p className="font-semibold">CRM com traje completo</p>}{item.description&&<p>{item.description}</p>}<MeetingResponse key={`${item.id}:${item.version}`} memberId={memberId} id={item.id} version={item.version} initial={item.myResponse}/></>}
  </section>;
  if (item.kind === "enquete") return <PollCard memberId={memberId} item={item} />;

  if (item.kind === "evento") {
    return (
      <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-na-gold-dark">
          {item.scope === "filial" ? (
            <>
              <PartyPopper size={14} /> {item.filialOrigem ? `EVENTO DE ${item.filialOrigem.replace(/^Nova Acrópole\s*-\s*/i, "").toUpperCase()}` : "EVENTO DA ESCOLA"}
            </>
          ) : (
            <>
              <Globe size={14} /> EVENTO {item.scope === "nacional" ? "NACIONAL" : "REGIONAL"}
            </>
          )}
        </div>
        {item.posterUrl&&<a href={item.posterUrl} target="_blank" rel="noopener noreferrer" className="mb-3 block">
          {/* eslint-disable-next-line @next/next/no-img-element -- cartaz privado com URL assinada */}
          <img src={item.posterUrl} alt={`Cartaz de ${item.title}`} loading="lazy" className="max-h-96 w-full rounded-lg object-contain"/>
        </a>}
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</div>
        <div className="mt-1 text-[11px] capitalize text-gray-500 dark:text-gray-400">
          {item.allDay ? formatDateBR(item.date) : item.date.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"})}
        </div>
        {item.location && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <MapPin size={11} className="shrink-0" /> {item.location}
          </div>
        )}
        {item.registrationUrl && <a href={item.registrationUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm font-semibold text-na-green dark:text-emerald-400">Inscrever-se no site do organizador ↗</a>}
        {(() => { const publico = eventoCompartilhavel(item); return publico && <CompartilharEvento evento={publico} />; })()}
        {item.description && <p className="mt-1.5 text-[12px] text-gray-600 dark:text-gray-300">{item.description}</p>}
        {item.capacity!==null&&item.capacity!==undefined&&<p className="mt-2 text-xs font-semibold">{item.availableSpots??0} vagas disponíveis de {item.capacity}</p>}
        {item.participantInstructions&&<p className="mt-2 whitespace-pre-wrap text-xs"><strong>Orientações: </strong>{item.participantInstructions}</p>}
        {item.contactInfo&&<p className="mt-2 break-words text-xs"><strong>Dúvidas: </strong>{item.contactInfo}</p>}
        {item.status === "cancelado" && <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">Evento cancelado. {item.minhaInscricao?.refundState&&item.minhaInscricao.refundState!=="nao_solicitado"?`Reembolso: ${REFUND_LABELS[item.minhaInscricao.refundState]??"em acompanhamento"}${item.minhaInscricao.refundedAmount?` · ${formatBRL(item.minhaInscricao.refundedAmount)}`:""}.`:"Consulte a Economia se houver pagamento."}</p>}
        {item.status !== "cancelado" && item.source === "manual" && item.scope === "filial" && (
          <>
            <div className="mt-2 text-xs font-bold text-na-green dark:text-emerald-400">
              {item.price > 0 ? formatBRL(item.price) : "Entrada Gratuita"}
            </div>
            {item.lancheCompartilhado && (
              <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-na-gold/15 px-2.5 py-1.5 text-xs font-bold text-na-gold-dark dark:bg-amber-950/40 dark:text-amber-300">
                <UtensilsCrossed size={13} className="shrink-0" /> Lanche compartilhado: leve algo para partilhar
              </div>
            )}
            {!item.minhaInscricao&&(item.registrationClosed||item.availableSpots===0)?<p className="mt-2 text-xs font-semibold">{item.registrationClosed?'Inscrições encerradas':'Vagas esgotadas'}</p>:somenteConsulta ? (
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{emBreve ? "Inscrição paga pelo Portal: em breve na sua filial. Fale com a secretaria." : "Online payment isn't available for your branch yet — please contact your branch."}</p>
            ) : (
              <InscricaoEvento memberId={memberId} eventId={item.id} price={item.price} inscricaoInicial={item.minhaInscricao} unavailableReason={item.paymentUnavailableReason} />
            )}
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
      {item.materiaNome && <div className="mt-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">Matéria: {item.materiaNome}</div>}
      {!!item.temas?.length && (
        <div className="mt-2 rounded-lg bg-white p-2 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <span className="font-semibold">Temas:</span>
          <ul className="mt-1 flex flex-col gap-0.5">
            {item.temas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
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

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const POR_PAGINA = 6;

/** Linha compacta da lista "Próximos eventos": data em destaque, título e tipo; tocar abre o dia. */
function LinhaProximo({ item, onAbrir }: { item: Exclude<AgendaItem, { kind: "enquete" }>; onAbrir: () => void }) {
  const Icone = item.kind === "evento" ? PartyPopper : item.kind === "reuniao" ? Users : GraduationCap;
  const tipo =
    item.kind === "evento"
      ? item.filialOrigem
        ? `Evento de ${item.filialOrigem.replace(/^Nova Acrópole\s*-\s*/i, "")}`
        : item.scope === "filial"
          ? "Evento da escola"
          : `Evento ${item.scope === "nacional" ? "nacional" : "regional"}`
      : item.kind === "reuniao"
        ? item.className
        : `${ACTIVITY_LABEL[item.type] ?? item.type} · ${item.className}`;
  const semHora = item.kind === "evento" && item.allDay;
  const cancelado = (item.kind === "evento" && item.status === "cancelado") || (item.kind === "reuniao" && item.status === "cancelada");
  return (
    <li>
      <button onClick={onAbrir} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-2.5 text-left transition hover:border-na-green/50 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60">
        <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-gray-100 py-1 leading-tight dark:bg-gray-800">
          <span className="text-[9px] font-semibold text-gray-500 uppercase dark:text-gray-400">{DIAS_CURTOS[item.date.getDay()]}</span>
          <span className="text-base font-black text-gray-900 dark:text-gray-100">{item.date.getDate()}</span>
          <span className="text-[9px] font-semibold text-gray-500 uppercase dark:text-gray-400">{MESES_CURTOS[item.date.getMonth()]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
            <Icone size={11} className="shrink-0" /> <span className="truncate">{tipo}</span>
          </span>
          <span className={`block truncate text-[13px] font-semibold ${cancelado ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100"}`}>{item.title}</span>
          <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            {!semHora && (
              <>
                <CalendarClock size={11} className="shrink-0" />
                {item.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </>
            )}
            {cancelado && <span className="font-semibold text-red-700 dark:text-red-300">Cancelado</span>}
            {!cancelado && item.kind === "evento" && item.lancheCompartilhado && <span className="font-semibold text-na-gold-dark dark:text-amber-300">· Lanche compartilhado</span>}
          </span>
        </span>
        <ChevronRight size={14} className="shrink-0 text-gray-400" />
      </button>
    </li>
  );
}

export function AgendaPanel({ memberId, items, somenteConsulta, emBreve }: { memberId: string; items: AgendaItem[]; somenteConsulta?: boolean; emBreve?: boolean }) {
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
  const [limiteProximos, setLimiteProximos] = useState(POR_PAGINA);
  const topo = useRef<HTMLDivElement>(null);

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
  // Próximos compromissos de OUTRAS datas (pedido do usuário 2026-10-21), de hoje em diante.
  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const proximos = items
    .filter((i): i is Exclude<AgendaItem, { kind: "enquete" }> => i.kind !== "enquete" && i.date >= inicioDeHoje && chaveDia(i.date) !== chaveDia(diaSelecionado))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  function mudarMes(delta: number) {
    setMesExibido(new Date(ano, mes + delta, 1));
  }

  function selecionarDia(dia: Date) {
    setDiaSelecionado(dia);
    if (dia.getMonth() !== mes || dia.getFullYear() !== ano) setMesExibido(new Date(dia.getFullYear(), dia.getMonth(), 1));
  }

  return (
    <div ref={topo} className="flex flex-col gap-4">
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
          itensDoDiaSelecionado.map((item) => <ItemCard key={itemKey(item)} memberId={memberId} item={item} somenteConsulta={somenteConsulta} emBreve={emBreve} />)
        )}
      </div>

      {proximos.length > 0 && (
        <section aria-labelledby="proximos-eventos" className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-300 dark:bg-gray-700" />
            <h3 id="proximos-eventos" className="text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300">
              Próximos eventos
            </h3>
            <span className="h-px flex-1 bg-gray-300 dark:bg-gray-700" />
          </div>
          <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">Em outras datas, não em {formatDateBR(diaSelecionado)}. Toque para ver o dia.</p>
          <ul className="flex flex-col gap-1.5">
            {proximos.slice(0, limiteProximos).map((item) => (
              <LinhaProximo
                key={itemKey(item)}
                item={item}
                onAbrir={() => {
                  selecionarDia(item.date);
                  topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            ))}
          </ul>
          {proximos.length > limiteProximos && (
            <button
              onClick={() => setLimiteProximos((n) => n + POR_PAGINA)}
              className="mt-1 rounded-xl border border-gray-300 px-4 py-2.5 text-[12px] font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Carregar mais eventos
            </button>
          )}
        </section>
      )}
    </div>
  );
}
