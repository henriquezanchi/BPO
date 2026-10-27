"use client";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import {REFUND_LABELS} from "@/lib/event-refund-policy";

import {usePaymentPolling} from "@/hooks/use-payment-polling";
import { CompartilharEvento, CompartilharWhatsApp } from "@/components/member/compartilhar-evento";
import Link from "next/link";
import { MeetingResponse } from "@/components/member/groups/meeting-response";
import { eventoCompartilhavel, linkWhatsAppDoEvento, urlDoEventoNoPortal } from "@/lib/compartilhar-evento";
import { checkStatusInscricaoEvento, inscreverEmEvento } from "@/lib/actions/event-actions";
import { cancelarMinhaInscricao, entrarNaListaDeEspera, sairDaListaDeEspera } from "@/lib/actions/event-self-actions";
import { votePoll } from "@/lib/actions/poll-actions";
import { mensagemErroAmigavel } from "@/lib/friendly-error";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import type { AgendaItem } from "@/lib/member-data";
import { CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Globe, GraduationCap, ListChecks, Loader2, MapPin, MessagesSquare, PartyPopper, Ticket, Users, UtensilsCrossed, Video } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { pedirNotificacoes } from "@/components/pwa/ativar-notificacoes";

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
  atendimento: "bg-na-green-dark",
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
  inicio,
  prazoDesistenciaDias,
}: {
  memberId: string;
  eventId: string;
  price: number;
  inicio: Date;
  prazoDesistenciaDias?: number | null;
  unavailableReason?: string | null;
  inscricaoInicial: Extract<AgendaItem, { kind: "evento" }>["minhaInscricao"];
}) {
  const [inscricao, setInscricao] = useState(inscricaoInicial);
  const [cpf, setCpf] = useState("");
  const [mostrarCpf, setMostrarCpf] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
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
        pedirNotificacoes("Inscrição feita. Quer ser lembrado do evento?");
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

  function aoCancelar(mensagem: string, desistenciaPaga?: boolean) {
    // Desistência paga fica registrada (histórico da devolução); a gratuita some.
    if (desistenciaPaga) setInscricao((atual) => (atual ? { ...atual, desistiu: true, refundState: "pendente" } : atual));
    else setInscricao(null);
    setMostrarCpf(false);
    setAviso(mensagem);
  }

  if (inscricao?.desistiu) {
    return (
      <div className="mt-2 flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Você desistiu desta inscrição.</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Devolução: {REFUND_LABELS[inscricao.refundState ?? "pendente"] ?? "em acompanhamento"}.</p>
        {aviso && <p role="status" className="text-[11px] text-gray-600 dark:text-gray-300">{aviso}</p>}
      </div>
    );
  }

  if (inscricao?.pago) {
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold text-na-green-dark dark:text-emerald-400">✓ Você está inscrito</p>
        {price > 0 ? (
          <DesistenciaPaga memberId={memberId} registrationId={inscricao.registrationId} inicio={inicio} prazoDias={prazoDesistenciaDias ?? null} onCancelada={aoCancelar} />
        ) : (
          <CancelarInscricao memberId={memberId} registrationId={inscricao.registrationId} onCancelada={aoCancelar} />
        )}
      </div>
    );
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
        <CancelarInscricao memberId={memberId} registrationId={inscricao.registrationId} onCancelada={aoCancelar} rotulo="Desistir e cancelar o PIX" />
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
        {isPending ? <Loader2 size={12} className="animate-spin" /> : "Inscreva-se"}
      </button>
      {erro && <p className="mt-1 text-[11px] text-na-danger-dark dark:text-red-400">{erro}</p>}
      {aviso && <p role="status" className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">{aviso}</p>}
    </div>
  );
}

const dataCurta = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Inscrição paga: desistir com devolução até o prazo do evento (padrão 3 dias antes). */
function DesistenciaPaga({
  memberId,
  registrationId,
  inicio,
  prazoDias,
  onCancelada,
}: {
  memberId: string;
  registrationId: string;
  inicio: Date;
  prazoDias: number | null;
  onCancelada: (mensagem: string, desistenciaPaga?: boolean) => void;
}) {
  const limite = prazoDias === null ? null : new Date(inicio.getTime() - prazoDias * 86_400_000);
  const [agora] = useState(() => Date.now());
  if (!limite) return <p className="text-[11px] text-gray-500 dark:text-gray-400">Este evento não prevê devolução em caso de desistência.</p>;
  if (agora > limite.getTime())
    return <p className="text-[11px] text-gray-500 dark:text-gray-400">O prazo para desistir com devolução terminou em {dataCurta(limite)}. Fale com a Economia.</p>;
  return (
    <CancelarInscricao
      memberId={memberId}
      registrationId={registrationId}
      onCancelada={onCancelada}
      rotulo={`Desistir com devolução (até ${dataCurta(limite)})`}
      confirmacao="Confirma a desistência? O valor pago será devolvido no mesmo PIX e sua vaga vai para outra pessoa."
    />
  );
}

/** Desistência pelo próprio aluno, com confirmação (pedido do usuário 2026-10-22). */
function CancelarInscricao({
  memberId,
  registrationId,
  onCancelada,
  rotulo = "Cancelar inscrição",
  confirmacao = "Confirma a desistência? Sua vaga vai para outra pessoa.",
}: {
  memberId: string;
  registrationId: string;
  onCancelada: (mensagem: string, desistenciaPaga?: boolean) => void;
  rotulo?: string;
  confirmacao?: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  function confirmar() {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await cancelarMinhaInscricao(memberId, registrationId);
        if (r.ok) onCancelada(r.mensagem, r.desistenciaPaga);
        else setErro(r.erro);
      } catch (e) {
        setErro(mensagemErroAmigavel(e));
      }
    });
  }
  if (!confirmando)
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="w-fit text-[11px] font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-700 dark:text-gray-400">
        {rotulo}
      </button>
    );
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
      <p className="text-[11px] text-gray-700 dark:text-gray-300">{confirmacao}</p>
      <div className="flex gap-2">
        <button type="button" onClick={confirmar} disabled={pendente} className="rounded-lg bg-na-danger px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
          {pendente ? "Cancelando..." : "Sim, desistir"}
        </button>
        <button type="button" onClick={() => setConfirmando(false)} disabled={pendente} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          Manter inscrição
        </button>
      </div>
      {erro && <p className="text-[11px] text-na-danger-dark dark:text-red-400">{erro}</p>}
    </div>
  );
}

/** Evento lotado: entrar ou sair da lista de espera (pedido do usuário 2026-10-22). */
function ListaDeEspera({ memberId, eventId, espera }: { memberId: string; eventId: string; espera: { posicao: number; vagaReservada: boolean } | null | undefined }) {
  const [naFila, setNaFila] = useState(!!espera);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  function alternar() {
    setMensagem(null);
    iniciar(async () => {
      try {
        const r = naFila ? await sairDaListaDeEspera(memberId, eventId) : await entrarNaListaDeEspera(memberId, eventId);
        if (r.ok) setNaFila(!naFila);
        setMensagem(r.ok ? r.mensagem : r.erro);
      } catch (e) {
        setMensagem(mensagemErroAmigavel(e));
      }
    });
  }
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <p className="text-xs font-semibold">Vagas esgotadas</p>
      {naFila && espera && !mensagem && <p className="text-[11px] text-gray-600 dark:text-gray-300">Você está na lista de espera ({espera.posicao}º da fila). Avisaremos no celular se abrir uma vaga.</p>}
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        className={`w-fit rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60 ${naFila ? "text-gray-600 underline underline-offset-2 dark:text-gray-300" : "border border-na-green text-na-green-dark dark:border-emerald-700 dark:text-emerald-400"}`}
      >
        {pendente ? <Loader2 size={12} className="animate-spin" /> : naFila ? "Sair da lista de espera" : "Entrar na lista de espera"}
      </button>
      {mensagem && <p role="status" className="text-[11px] text-gray-600 dark:text-gray-300">{mensagem}</p>}
    </div>
  );
}

function ItemCard({ memberId, item, somenteConsulta, emBreve, aberto }: { memberId: string; item: AgendaItem; somenteConsulta?: boolean; emBreve?: boolean; aberto?: boolean }) {
  if (item.kind === 'reuniao') return <section className="space-y-2 rounded-xl border border-na-green/30 p-4 text-sm"><CollapsibleSection defaultOpen={aberto} title={<h3 className="font-bold">{item.title}</h3>}>
    <p className="font-semibold text-na-green-dark dark:text-na-green-light">{item.className} · Convocação</p><p>{item.date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})} — {item.endsAt.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</p>
    {item.status==='cancelada'?<p>Reunião cancelada: {item.cancellationReason}</p>:<><p>Comparecimento obrigatório. Se não puder participar, registre uma justificativa.</p>{item.fullUniform&&<p className="font-semibold">CRM com traje completo</p>}{item.description&&<p>{item.description}</p>}<MeetingResponse key={`${item.id}:${item.version}`} memberId={memberId} id={item.id} version={item.version} initial={item.myResponse}/></>}
  </CollapsibleSection></section>;
  if (item.kind === "enquete") return <PollCard memberId={memberId} item={item} />;
  if (item.kind === "atendimento") return <CartaoAtendimento item={item} />;

  if (item.kind === "evento") {
    return (
      <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-na-gold-dark">
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
        {item.status !== "cancelado" && (
          <CompartilharWhatsApp compacto linkTexto={linkWhatsAppDoEvento(item, URL_PORTAL)} evento={{
            ...item,
            title: item.title.replace(/\*/g, "").trim(),
            registrationUrl: eventoCompartilhavel(item)?.registrationUrl ?? urlDoEventoNoPortal(item.id, URL_PORTAL),
            imagem: item.posterUrl,
            interno: item.source !== "ulisses",
          }} />
        )}
        </div>
        {/* Fechado por padrão (pedido do usuário 2026-10-25): descrição e detalhes só ao tocar. */}
        <details open={aberto} className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</span>
        <span className="mt-1 block text-[11px] capitalize text-gray-500 dark:text-gray-400">
          {item.allDay ? formatDateBR(item.date) : item.date.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"})}
        </span>
        {item.location && (
          <span className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <MapPin size={11} className="shrink-0" /> {item.location}
          </span>
        )}
        {item.status === "cancelado" && <span className="mt-1 block text-[11px] font-semibold text-red-700 dark:text-red-300">Cancelado</span>}
        </span>
        <ChevronDown size={16} className="mt-0.5 shrink-0 text-gray-400 transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2">
        {item.posterUrl&&<a href={item.posterUrl} target="_blank" rel="noopener noreferrer" className="mb-3 block">
          {/* eslint-disable-next-line @next/next/no-img-element -- cartaz privado com URL assinada */}
          <img src={item.posterUrl} alt={`Cartaz de ${item.title}`} loading="lazy" className="max-h-96 w-full rounded-lg object-contain"/>
        </a>}
        {/* Evento do Ágora (túnel, 2026-10-27): valor, prazo/lote e se a pessoa já se inscreveu lá. */}
        {item.agora && (item.agora.inscrito || item.agora.valor || item.agora.prazo) && (
          <p className="mt-1 text-[12px] text-gray-600 dark:text-gray-300">
            {item.agora.inscrito && <span className="mr-2 font-semibold text-na-green-dark dark:text-emerald-400">Você já está inscrito(a)</span>}
            {[item.agora.valor, item.agora.prazo].filter(Boolean).join(" · ")}
          </p>
        )}
        {item.registrationUrl && <a href={item.registrationUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark">{item.source === "agora" ? (item.agora?.inscrito ? "Ver no Ágora" : "Inscrever-se no Ágora") : "Inscreva-se"}</a>}
        {(() => { const publico = eventoCompartilhavel(item); return publico && <CompartilharEvento evento={publico} />; })()}
        {item.description && <p className="mt-1.5 whitespace-pre-line break-words text-[12px] text-gray-600 dark:text-gray-300">{item.description}</p>}
        {item.capacity!==null&&item.capacity!==undefined&&<p className="mt-2 text-xs font-semibold">{(item.availableSpots??0)===1?'1 vaga disponível':`${item.availableSpots??0} vagas disponíveis`} de {item.capacity}</p>}
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
            {item.minhaEspera?.vagaReservada && !item.minhaInscricao && (
              <p className="mt-2 rounded-lg bg-na-success-light px-2.5 py-1.5 text-xs font-semibold text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300">Abriu uma vaga e ela está reservada para você por 12 horas. Inscreva-se abaixo.</p>
            )}
            {!item.minhaInscricao&&item.registrationClosed?<p className="mt-2 text-xs font-semibold">Inscrições encerradas</p>:!item.minhaInscricao&&item.availableSpots===0?(somenteConsulta?<p className="mt-2 text-xs font-semibold">Vagas esgotadas</p>:<ListaDeEspera memberId={memberId} eventId={item.id} espera={item.minhaEspera} />):somenteConsulta ? (
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{emBreve ? "Inscrição paga pelo Portal: em breve na sua filial. Fale com a secretaria." : "Online payment isn't available for your branch yet — please contact your branch."}</p>
            ) : (
              <InscricaoEvento memberId={memberId} eventId={item.id} price={item.price} inscricaoInicial={item.minhaInscricao} unavailableReason={item.paymentUnavailableReason} inicio={item.date} prazoDesistenciaDias={item.prazoDesistenciaDias} />
            )}
          </>
        )}
        </div>
        </details>
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
      {item.description && <p className="mt-2 whitespace-pre-line break-words text-[11px] text-gray-600 dark:text-gray-400">{item.description}</p>}
    </div>
  );
}

/** Conversa individual marcada (aluno ou instrutor); cancelar e detalhes ficam na página de atendimentos. */
function CartaoAtendimento({ item }: { item: Extract<AgendaItem, { kind: "atendimento" }> }) {
  const MODALIDADE: Record<string, string> = { presencial: "Presencial", online: "Online" };
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-na-green/40 bg-white p-3 dark:bg-gray-900">
      <p className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">
        <MessagesSquare size={11} /> Conversa individual
      </p>
      <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{item.papel === "aluno" ? `Com ${item.comQuem}` : `Com ${item.comQuem} (aluno)`}</p>
      <p className="text-[12px] text-gray-600 dark:text-gray-300">
        {item.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}–{item.endsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400">
        {item.modalidade === "online" ? <Video size={12} /> : <MapPin size={12} />}
        {MODALIDADE[item.modalidade] ?? item.modalidade}
        {item.local ? ` · ${item.local}` : ""}
      </p>
      {item.assunto && <p className="text-[12px] text-gray-600 italic dark:text-gray-300">“{item.assunto}”</p>}
      <div className="flex flex-wrap gap-3 text-[12px] font-semibold">
        {item.linkOnline && (
          <a href={item.linkOnline} target="_blank" rel="noopener noreferrer" className="text-na-green-dark underline dark:text-emerald-400">
            Entrar na chamada
          </a>
        )}
        <Link href={item.papel === "aluno" ? "/atendimentos" : "/professor/atendimentos"} className="text-gray-500 hover:underline dark:text-gray-400">
          Ver ou cancelar
        </Link>
      </div>
    </div>
  );
}

/** Atalho para marcar conversa com o instrutor (só para quem está numa turma com instrutor no Portal). */
function LinkAtendimento() {
  return (
    <Link
      href="/atendimentos"
      className="flex items-center gap-3 rounded-xl border border-na-green/40 bg-na-green-light/40 px-3 py-2.5 transition hover:border-na-green dark:border-emerald-900 dark:bg-emerald-950/20"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-na-green/20 text-na-green-dark dark:text-emerald-300">
        <MessagesSquare size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-gray-900 dark:text-gray-100">Conversar com meu instrutor</span>
        <span className="block text-[11px] text-gray-600 dark:text-gray-400">Marque um horário individual</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-gray-400" />
    </Link>
  );
}

function itemKey(item: AgendaItem) {
  return `${item.kind}-${item.id}`;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const POR_PAGINA = 6;
const URL_PORTAL = "https://portal-na-one.vercel.app/portal";

/** Atalho para "Meus eventos" dentro da Agenda (pedido do usuário 2026-10-22). */
function LinkMeusEventos() {
  return (
    <Link
      href="/eventos"
      className="flex items-center gap-3 rounded-xl border border-na-gold/40 bg-na-gold/10 px-3 py-2.5 transition hover:border-na-gold dark:border-amber-900 dark:bg-amber-950/20"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-na-gold/25 text-na-gold-dark dark:text-amber-300">
        <Ticket size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-gray-900 dark:text-gray-100">Meus eventos</span>
        <span className="block text-[11px] text-gray-600 dark:text-gray-400">Inscrições, participação e recepção</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-gray-400" />
    </Link>
  );
}

/** Linha compacta da lista "Próximos eventos": data em destaque, título e tipo; tocar abre o dia. */
function LinhaProximo({ item, onAbrir }: { item: Exclude<AgendaItem, { kind: "enquete" }>; onAbrir: () => void }) {
  const Icone = item.kind === "evento" ? PartyPopper : item.kind === "reuniao" ? Users : item.kind === "atendimento" ? MessagesSquare : GraduationCap;
  const tipo =
    item.kind === "evento"
      ? item.filialOrigem
        ? `Evento de ${item.filialOrigem.replace(/^Nova Acrópole\s*-\s*/i, "")}`
        : item.scope === "filial"
          ? "Evento da escola"
          : `Evento ${item.scope === "nacional" ? "nacional" : "regional"}`
      : item.kind === "reuniao"
        ? item.className
        : item.kind === "atendimento"
          ? "Conversa individual"
          : `${ACTIVITY_LABEL[item.type] ?? item.type} · ${item.className}`;
  const semHora = item.kind === "evento" && item.allDay;
  const cancelado = (item.kind === "evento" && item.status === "cancelado") || (item.kind === "reuniao" && item.status === "cancelada");
  // Cor por categoria (pedido do usuário 2026-10-25: "eventos futuros um pouco sem graça").
  const cor = cancelado ? COR_PROXIMO.cancelado : COR_PROXIMO[categoriaProximo(item)];
  return (
    <li>
      <button onClick={onAbrir} className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${cor.cartao}`}>
        <span className={`flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 leading-tight shadow-sm ${cor.data}`}>
          <span className="text-[9px] font-bold uppercase opacity-85">{DIAS_CURTOS[item.date.getDay()]}</span>
          <span className="text-lg font-black">{item.date.getDate()}</span>
          <span className="text-[9px] font-bold uppercase opacity-85">{MESES_CURTOS[item.date.getMonth()]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase ${cor.rotulo}`}>
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
        <ChevronRight size={14} className={`shrink-0 ${cor.seta}`} />
      </button>
    </li>
  );
}

type CategoriaProximo = "escola" | "rede" | "outraFilial" | "grupo" | "turma" | "atendimento" | "cancelado";

function categoriaProximo(item: Exclude<AgendaItem, { kind: "enquete" }>): Exclude<CategoriaProximo, "cancelado"> {
  if (item.kind === "evento") return item.filialOrigem ? "outraFilial" : item.scope === "filial" ? "escola" : "rede";
  if (item.kind === "reuniao") return "grupo";
  if (item.kind === "atendimento") return "atendimento";
  return "turma";
}

/** Cores dos próximos compromissos: verde suave (escola), turquesa (nacional/regional), laranja (outra filial), verdes (grupos, turma, conversa). */
const COR_PROXIMO: Record<CategoriaProximo, { cartao: string; data: string; rotulo: string; seta: string }> = {
  // Evento da escola em verde suave (pedido do usuário 2026-10-26: o dourado/laranja chamava atenção demais).
  escola: {
    cartao: "border-na-green/20 bg-na-green-light/25 hover:border-na-green/50 dark:border-emerald-900/50 dark:bg-emerald-950/15 dark:hover:border-emerald-700/70",
    data: "bg-na-green-light text-na-green-dark dark:bg-emerald-900/50 dark:text-emerald-200",
    rotulo: "text-na-green-dark/80 dark:text-emerald-300/80",
    seta: "text-na-green/70 dark:text-emerald-500/70",
  },
  rede: {
    cartao: "border-na-turquesa/40 bg-na-turquesa/10 hover:border-na-turquesa dark:border-cyan-800/60 dark:bg-cyan-950/25 dark:hover:border-cyan-600",
    data: "bg-na-turquesa text-white",
    rotulo: "text-cyan-800 dark:text-cyan-300",
    seta: "text-cyan-700 dark:text-cyan-400",
  },
  outraFilial: {
    cartao: "border-na-laranja/40 bg-na-laranja/10 hover:border-na-laranja dark:border-orange-800/60 dark:bg-orange-950/25 dark:hover:border-orange-600",
    data: "bg-na-laranja text-white",
    rotulo: "text-orange-800 dark:text-orange-300",
    seta: "text-orange-700 dark:text-orange-400",
  },
  grupo: {
    cartao: "border-na-green/40 bg-na-green-light/40 hover:border-na-green dark:border-emerald-800/60 dark:bg-emerald-950/25 dark:hover:border-emerald-600",
    data: "bg-na-green text-white",
    rotulo: "text-na-green-dark dark:text-emerald-300",
    seta: "text-na-green-dark dark:text-emerald-400",
  },
  turma: {
    cartao: "border-na-green-dark/30 bg-na-green-light/30 hover:border-na-green-dark dark:border-teal-800/60 dark:bg-teal-950/25 dark:hover:border-teal-600",
    data: "bg-na-green-dark text-white",
    rotulo: "text-na-green-dark dark:text-teal-300",
    seta: "text-na-green-dark dark:text-teal-400",
  },
  atendimento: {
    cartao: "border-na-green/40 bg-na-green-light/40 hover:border-na-green dark:border-emerald-800/60 dark:bg-emerald-950/25 dark:hover:border-emerald-600",
    data: "bg-gradient-to-b from-na-green to-na-green-dark text-white",
    rotulo: "text-na-green-dark dark:text-emerald-300",
    seta: "text-na-green-dark dark:text-emerald-400",
  },
  cancelado: {
    cartao: "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/60",
    data: "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    rotulo: "text-gray-500 dark:text-gray-400",
    seta: "text-gray-400",
  },
};

export function AgendaPanel({ memberId, items, somenteConsulta, emBreve, eventoId, podeMarcarAtendimento }: { memberId: string; items: AgendaItem[]; somenteConsulta?: boolean; emBreve?: boolean; eventoId?: string; podeMarcarAtendimento?: boolean }) {
  const eventoCompartilhado = items.find((item) => item.kind === "evento" && item.id === eventoId);
  const avisoEvento = eventoId && !eventoCompartilhado
    ? <p role="status" className="text-sm text-gray-600 dark:text-gray-300">Este evento não está disponível na sua agenda. Ele pode ter encerrado ou ser destinado a outra escola.</p>
    : null;
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

  // Abre sempre em hoje (pedido do usuário 2026-10-25); os próximos de outras datas ficam na lista abaixo.
  const [diaSelecionado, setDiaSelecionado] = useState(() => hoje);
  const [mesExibido, setMesExibido] = useState(() => new Date(diaSelecionado.getFullYear(), diaSelecionado.getMonth(), 1));
  const [limiteProximos, setLimiteProximos] = useState(POR_PAGINA);
  // Próximo evento tocado: abre o detalhe dele já expandido e rola até ele (pedido do usuário 2026-10-26).
  const [itemAberto, setItemAberto] = useState<string | null>(null);
  const calendario = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLDivElement>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <LinkMeusEventos />
        {podeMarcarAtendimento && <LinkAtendimento />}
        {avisoEvento}
        <p className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">Nenhum evento ou atividade agendada no momento.</p>
      </div>
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
      {avisoEvento}
      {eventoCompartilhado && <section aria-label="Evento compartilhado" className="space-y-2">
        <CollapsibleSection defaultOpen title={<h3 className="text-xs font-semibold text-na-green-dark dark:text-emerald-400">Evento compartilhado</h3>}>
        <ItemCard key={itemKey(eventoCompartilhado)} memberId={memberId} item={eventoCompartilhado} somenteConsulta={somenteConsulta} emBreve={emBreve} aberto />
      </CollapsibleSection></section>}
      {/* Próximos eventos sempre abertos e no topo (pedido do usuário 2026-10-25); depois Meus eventos e o calendário. */}
      {proximos.length > 0 && (
        <section aria-labelledby="proximos-eventos" className="flex flex-col gap-2">
          <h3 id="proximos-eventos" className="text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300">
            Próximos eventos
          </h3>
          <ul className="flex flex-col gap-1.5">
            {proximos.slice(0, limiteProximos).map((item) => (
              <LinhaProximo
                key={itemKey(item)}
                item={item}
                onAbrir={() => {
                  const chave = itemKey(item);
                  setItemAberto(chave);
                  selecionarDia(item.date);
                  setTimeout(() => document.getElementById(`agenda-item-${chave}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
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
      <LinkMeusEventos />
      {podeMarcarAtendimento && <LinkAtendimento />}
      <div ref={calendario} className="scroll-mt-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
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
            Nada agendado para {diaSelecionado.toLocaleDateString("pt-BR")}.
          </p>
        ) : (
          itensDoDiaSelecionado.filter((item) => item !== eventoCompartilhado).map((item) => (
            <div key={itemKey(item)} id={`agenda-item-${itemKey(item)}`} className="scroll-mt-4">
              <ItemCard key={`${itemKey(item)}:${itemAberto === itemKey(item)}`} memberId={memberId} item={item} somenteConsulta={somenteConsulta} emBreve={emBreve} aberto={itemAberto === itemKey(item)} />
            </div>
          ))
        )}
      </div>

    </div>
  );
}
