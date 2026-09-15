import type { AgendaItem } from "@/lib/member-data";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { GraduationCap, PartyPopper } from "lucide-react";

const ACTIVITY_LABEL: Record<string, string> = {
  prova: "Prova",
  trabalho: "Trabalho",
  leitura: "Leitura",
  atividade_turma: "Atividade de turma",
};

export function AgendaPanel({ items }: { items: AgendaItem[] }) {
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
        item.kind === "evento" ? (
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
          </div>
        ),
      )}
    </div>
  );
}
