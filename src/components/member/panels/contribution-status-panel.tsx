import type { ContributionMonthlyStatus } from "@prisma/client";
import { AlertTriangle } from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ESTILO_POR_STATUS: Record<string, string> = {
  paga: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  atrasado: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
  isento: "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
  em_branco: "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500",
};

const LABEL_POR_STATUS: Record<string, string> = {
  paga: "Paga",
  atrasado: "Em atraso",
  isento: "Isento",
  em_branco: "—",
};

/**
 * Situação real da contribuição mês a mês, sincronizada da Ficha Anual do
 * Mercúrio (ver scripts/sync-monthly-status.ts) — não é a composição
 * (rubricas que somam o valor) nem os recibos (pagamentos já emitidos),
 * é o status PAGA/EM ATRASO/ISENTO/EM BRANCO de cada mês do ano.
 *
 * Pagamento pelo Portal ainda não está disponível — depende de um
 * gateway real (ver .env.example, ASAAS_API_KEY vazio) e do lançamento
 * automático no Mercúrio, ambos pendentes.
 */
export function ContributionStatusPanel({ monthlyStatus }: { monthlyStatus: ContributionMonthlyStatus[] }) {
  const porMes = new Map(monthlyStatus.map((m) => [m.month, m]));
  const mesesAtrasados = monthlyStatus.filter((m) => m.status === "atrasado");

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Situação da sua contribuição em {new Date().getFullYear()}:
      </p>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {MESES.map((nome, i) => {
          const mes = i + 1;
          const registro = porMes.get(mes);
          const status = registro?.status ?? "em_branco";
          return (
            <div key={mes} className={`rounded-lg border p-2 text-center text-[11px] ${ESTILO_POR_STATUS[status]}`}>
              <div className="font-semibold">{nome}</div>
              <div className="mt-0.5">{LABEL_POR_STATUS[status]}</div>
            </div>
          );
        })}
      </div>

      {mesesAtrasados.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Pagamento direto pelo Portal ainda não está disponível. Pra regularizar {mesesAtrasados.length === 1 ? "o mês em atraso" : "os meses em atraso"}, fale com a secretaria da escola.
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Nenhum mês em atraso este ano.</p>
      )}
    </div>
  );
}
