import { formatBRL, formatDateBR } from "@/lib/format";
import type { Contribution } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";

/**
 * Visão simplificada: hoje a Contribution é um valor único por mês. Quando
 * o modelo de composição itemizada (contribuição + Fortuna + doações etc.)
 * for definido, este painel passa a listar os itens em vez do total único.
 */
export function ContributionPanel({ contributions }: { contributions: Contribution[] }) {
  const latest = contributions[0];

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-500">Sua contribuição mensal atual:</p>

      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
        {latest ? (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-na-green" /> Contribuição de Membro
            </span>
            <strong>{formatBRL(Number(latest.amount))}</strong>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Nenhuma contribuição cadastrada ainda.</p>
        )}

        {latest && (
          <>
            <hr className="my-2.5 border-dashed border-gray-300" />
            <div className="flex justify-between text-sm font-bold text-na-green-dark">
              <span>Total da Composição</span>
              <span>{formatBRL(Number(latest.amount))}/mês</span>
            </div>
          </>
        )}
      </div>

      <div className="mb-2 text-[13px] font-bold text-gray-900">Histórico Recente</div>
      <div className="flex flex-col gap-1.5">
        {contributions.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-2.5 text-xs"
          >
            <span>Venc. {formatDateBR(c.dueDate)}</span>
            <span className="font-semibold">{formatBRL(Number(c.amount))}</span>
            <span
              className={
                c.status === "pago"
                  ? "font-semibold text-green-700"
                  : c.status === "atrasado"
                    ? "font-semibold text-red-700"
                    : "font-semibold text-amber-700"
              }
            >
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
