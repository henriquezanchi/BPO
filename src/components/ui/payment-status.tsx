"use client";

import type { PollingState } from "@/lib/polling";
import { Loader2, RefreshCw } from "lucide-react";

export function PaymentStatus({ state, onRetry }: { state: PollingState; onRetry: () => void }) {
  const problem = state === "error" || state === "paused";
  return <div className="w-full text-center">
    <p role="status" className={`flex items-center justify-center gap-2 text-xs ${problem ? "text-na-warning-dark dark:text-na-warning-light" : "text-gray-600 dark:text-gray-400"}`}>
      {!problem && <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />}
      {state === "error" ? "Não foi possível consultar agora. Vamos tentar novamente automaticamente." : state === "paused" ? "A consulta automática foi pausada após 10 minutos. Isso não cancela seu pagamento." : "Aguardando confirmação do pagamento..."}
    </p>
    {problem && <button type="button" onClick={onRetry} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-na-green-dark dark:text-na-green-light"><RefreshCw size={16} /> Consultar novamente</button>}
  </div>;
}
