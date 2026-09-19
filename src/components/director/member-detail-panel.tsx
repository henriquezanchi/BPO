"use client";

import { getMemberDetail, updateMemberEconomicNotes } from "@/lib/actions/director-actions";
import { formatBRL, whatsappHref } from "@/lib/format";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ESTILO_MES: Record<string, string> = {
  paga: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  atrasado: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400",
  isento: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  em_branco: "bg-gray-50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500",
};

type MemberDetail = Awaited<ReturnType<typeof getMemberDetail>>;

export function MemberDetailPanel({ schoolId, memberId }: { schoolId: string; memberId: string }) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [notas, setNotas] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMemberDetail(schoolId, memberId).then((d) => {
      setDetail(d);
      setNotas(d.economicNotes ?? "");
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

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{detail.name}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Matrícula: #{detail.registrationNo ?? "—"} {detail.email && `· ${detail.email}`}
          </p>
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
        <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Em negociação:</strong> {detail.negociacaoAberta.notes}
          {detail.negociacaoAberta.promisedPaymentDate && ` — promessa: ${new Date(detail.negociacaoAberta.promisedPaymentDate).toLocaleDateString("pt-BR")}`}
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
