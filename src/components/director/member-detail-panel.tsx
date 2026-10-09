"use client";

import { getMemberDetail, updateMemberDataEntrada, updateMemberEconomicNotes } from "@/lib/actions/director-actions";
import { formatBRL, formatDateBR, whatsappHref } from "@/lib/format";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ESTILO_MES: Record<string, string> = {
  paga: "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-400",
  atrasado: "bg-na-danger-light text-na-danger-dark dark:bg-red-950/40 dark:text-red-400",
  isento: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  em_branco: "bg-gray-50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500",
};

type MemberDetail = Awaited<ReturnType<typeof getMemberDetail>>;

export function MemberDetailPanel({ schoolId, memberId }: { schoolId: string; memberId: string }) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [notas, setNotas] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [dataEntrada, setDataEntrada] = useState("");
  const [dataEntradaSalva, setDataEntradaSalva] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMemberDetail(schoolId, memberId).then((d) => {
      setDetail(d);
      setNotas(d.economicNotes ?? "");
      setDataEntrada(d.dataEntradaEscola ? new Date(d.dataEntradaEscola).toISOString().slice(0, 10) : "");
    });
  }, [schoolId, memberId]);

  if (!detail) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const porMes = new Map(detail.monthlyStatus.map((s) => [s.month, s.status]));
  const compositionTotal = detail.compositionItems.reduce((soma, i) => soma + i.amount, 0);

  function handleSalvarNotas() {
    startTransition(async () => {
      await updateMemberEconomicNotes(schoolId, memberId, notas);
      setSalvo(true);
    });
  }

  function handleSalvarDataEntrada() {
    startTransition(async () => {
      await updateMemberDataEntrada(schoolId, memberId, dataEntrada);
      setDataEntradaSalva(true);
    });
  }

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            {detail.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- vem do Supabase Storage, não é um asset local
              <img src={detail.avatarUrl} alt={detail.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{detail.name.charAt(0)}</span>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{detail.name}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Matrícula: #{detail.registrationNo ?? "—"} {detail.email && `· ${detail.email}`}
            </p>
          </div>
        </div>
        <a
          href={whatsappHref(detail.whatsapp)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-[11px] font-semibold text-white"
        >
          <MessageCircle size={12} /> WhatsApp
        </a>
      </div>

      {detail.negociacaoAberta && (
        <div className="rounded-lg bg-na-warning-light p-3 text-[11px] text-na-warning-dark dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Em negociação:</strong> {detail.negociacaoAberta.notes}
          {detail.negociacaoAberta.promisedPaymentDate && ` — promessa: ${new Date(detail.negociacaoAberta.promisedPaymentDate).toLocaleDateString("pt-BR")}`}
        </div>
      )}

      {detail.gafSolicitadoEm && (
        <div className="rounded-lg bg-purple-50 p-3 text-[11px] text-purple-800 dark:bg-purple-950/30 dark:text-purple-300">
          <strong>Interesse no GAF</strong> — solicitado em {formatDateBR(detail.gafSolicitadoEm)}
        </div>
      )}

      {detail.voluntariadoOferecido && (
        <div className="rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <strong>Ofereceu apoio voluntário</strong> em {formatDateBR(detail.voluntariadoOferecido.createdAt)}: {detail.voluntariadoOferecido.secretarias.join(", ")}
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Composição — {formatBRL(compositionTotal)}/mês</p>
        {detail.compositionItems.length === 0 ? (
          <p className="text-[11px] text-gray-400">Nenhum item de composição.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {detail.compositionItems.map((i) => (
              <li key={i.id} className="flex justify-between rounded bg-gray-50 px-2 py-1 text-[11px] dark:bg-gray-800">
                <span className="text-gray-700 dark:text-gray-300">{i.label}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBRL(i.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Situação mês a mês ({new Date().getFullYear()})</p>
        <div className="grid grid-cols-4 gap-1.5">
          {MESES.map((label, i) => {
            const mes = i + 1;
            const status = porMes.get(mes) ?? "em_branco";
            return (
              <div key={mes} className={`rounded-lg px-2 py-2 text-center text-[10px] font-semibold ${ESTILO_MES[status] ?? ESTILO_MES.em_branco}`}>
                {label}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          Data de Entrada na Escola <span className="font-normal text-gray-400">(pra Jornada Filosófica do aluno)</span>
        </p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dataEntrada}
            onChange={(e) => {
              setDataEntrada(e.target.value);
              setDataEntradaSalva(false);
            }}
            className="rounded-lg border border-gray-300 p-2 text-[13px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            onClick={handleSalvarDataEntrada}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar
          </button>
        </div>
        {dataEntradaSalva && <p className="mt-1 text-[11px] text-na-green-dark dark:text-emerald-400">Salvo.</p>}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Anotações Econômicas sobre o Aluno</p>
        <textarea
          value={notas}
          onChange={(e) => {
            setNotas(e.target.value.slice(0, 255));
            setSalvo(false);
          }}
          maxLength={255}
          rows={3}
          className="w-full rounded-lg border border-gray-300 p-2 text-[13px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{notas.length}/255</span>
          <button
            onClick={handleSalvarNotas}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar
          </button>
        </div>
        {salvo && <p className="mt-1 text-[11px] text-na-green-dark dark:text-emerald-400">Salvo — pode levar até 24h para ser confirmado no Mercúrio.</p>}
      </div>
    </div>
  );
}
