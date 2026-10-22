import { EventAttendanceReply } from "@/components/member/event-attendance-reply";
import { REFUND_LABELS } from "@/lib/event-refund-policy";
import type { Event, EventRegistration } from "@prisma/client";
import {
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
  PartyPopper,
  UtensilsCrossed,
} from "lucide-react";

/** Cartão de "Meus eventos" (pedido do usuário 2026-10-22): data em destaque, categoria e situação colorida. */
const TZ = "America/Sao_Paulo";
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export type Registro = EventRegistration & {
  event: Event & { school: { name: string } | null };
};

/** Partes da data no fuso de Brasília (o servidor roda em UTC). */
export function partes(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const semana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    p.weekday,
  );
  return {
    semana: DIAS[semana] ?? "",
    dia: p.day,
    mes: MESES[Number(p.month) - 1],
    hora: `${p.hour}:${p.minute}`,
  };
}

function situacao(r: Registro): { texto: string; cor: string } {
  const verde =
    "bg-na-success-light text-na-success-dark dark:bg-emerald-950/50 dark:text-emerald-300";
  const ambar =
    "bg-na-warning-light text-na-warning-dark dark:bg-amber-950/50 dark:text-amber-300";
  const cinza = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  const vermelho =
    "bg-na-danger-light text-na-danger-dark dark:bg-red-950/50 dark:text-red-300";
  if (r.desistenciaEm)
    return {
      texto: `Você desistiu · devolução: ${(REFUND_LABELS[r.refundState] ?? "em acompanhamento").toLowerCase()}`,
      cor: cinza,
    };
  if (r.event.status === "cancelado")
    return {
      texto:
        r.refundState !== "nao_solicitado"
          ? `Evento cancelado · ${(REFUND_LABELS[r.refundState] ?? "").toLowerCase()}`
          : "Evento cancelado",
      cor: vermelho,
    };
  if (r.paid)
    return {
      texto:
        Number(r.event.price) > 0 ? "Inscrição paga" : "Inscrição confirmada",
      cor: verde,
    };
  if (r.paymentState === "revisao")
    return { texto: "Cobrança em conferência pela Economia", cor: ambar };
  return { texto: "Aguardando pagamento do PIX", cor: ambar };
}

function categoria(r: Registro, minhaEscola: string) {
  const e = r.event;
  if (e.scope === "nacional" || e.scope === "regional")
    return { icone: Globe, texto: `Evento ${e.scope}` };
  if (e.schoolId && e.schoolId !== minhaEscola && e.school)
    return {
      icone: PartyPopper,
      texto: `Evento de ${e.school.name.replace(/^Nova Acrópole\s*-\s*/i, "")}`,
    };
  return { icone: PartyPopper, texto: "Evento da escola" };
}

export function CartaoEvento({
  r,
  minhaEscola,
  passado,
  memberId,
  podeResponder,
}: {
  r: Registro;
  minhaEscola: string;
  passado: boolean;
  memberId: string;
  podeResponder: boolean;
}) {
  const d = partes(r.event.startsAt);
  const cat = categoria(r, minhaEscola);
  const sit = situacao(r);
  const Icone = cat.icone;
  const valeParticipacao =
    r.paid && !r.desistenciaEm && r.event.status === "publicado";
  return (
    <article className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
      <div
        className={`flex w-14 shrink-0 flex-col items-center justify-center self-start rounded-xl py-2 leading-tight ${passado ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" : "bg-na-green text-white"}`}
      >
        <span className="text-[10px] font-semibold uppercase opacity-90">
          {d.semana}
        </span>
        <span className="text-xl font-black">{d.dia}</span>
        <span className="text-[10px] font-semibold uppercase opacity-90">
          {d.mes}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-na-gold-dark uppercase dark:text-amber-300">
          <Icone size={12} className="shrink-0" /> {cat.texto}
        </p>
        <h3
          className={`text-[15px] leading-snug font-bold ${r.event.status === "cancelado" ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100"}`}
        >
          {r.event.title}
        </h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={12} /> {d.hora}
          </span>
          {r.event.location && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={12} className="shrink-0" />{" "}
              <span className="truncate">{r.event.location}</span>
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sit.cor}`}
          >
            {sit.texto}
          </span>
          {r.event.lancheCompartilhado &&
            !passado &&
            r.event.status === "publicado" && (
              <span className="flex items-center gap-1 rounded-full bg-na-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-na-gold-dark dark:bg-amber-950/40 dark:text-amber-300">
                <UtensilsCrossed size={11} /> Lanche compartilhado
              </span>
            )}
        </div>
        {passado && valeParticipacao && (
          <p className="flex items-center gap-1 text-[12px] text-gray-600 dark:text-gray-400">
            {r.checkedIn ? (
              <>
                <CheckCircle2 size={13} className="text-na-success" /> Presença
                conferida pela recepção
              </>
            ) : r.selfReportedAttendance ? (
              `Sua resposta: ${r.selfReportedAttendance === "sim" ? "participei" : "não participei"}`
            ) : (
              "Presença ainda não conferida"
            )}
          </p>
        )}
        {passado && valeParticipacao && podeResponder && !r.checkedIn && (
          <EventAttendanceReply memberId={memberId} registrationId={r.id} />
        )}
      </div>
    </article>
  );
}
