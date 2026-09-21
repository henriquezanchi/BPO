"use client";

import { checkFortunaTopUpStatus, createFortunaTopUpCharge } from "@/lib/actions/fortuna-topup-actions";
import { formatBRL } from "@/lib/format";
import type { FortunaBalanceView } from "@/lib/member-data";
import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * Recarga real da carteira Fortuna via PIX (Asaas) — CPF nunca fica
 * guardado no nosso banco, mesma minimização de ContributionStatusPanel.
 * Depois de pago, o crédito É automático (PUT /balance/with-receipt,
 * confirmado ao vivo em 2026-09-21 — ver fortunaCreditarSaldo em
 * fortuna/client.ts): o polling detecta o PIX pago e credita na hora. Só
 * em caso de falha (raro — membro desvinculado, API fora do ar) é que cai
 * numa fila de exceção manual (ver FortunaTab no Painel do Diretor).
 */
export function FortunaTopUpPanel({ balances, memberId }: { balances: FortunaBalanceView[]; memberId: string }) {
  const home = balances.find((b) => b.isHome) ?? balances[0];
  const [branchId, setBranchId] = useState(home?.branchId);
  const [amount, setAmount] = useState("20,00");
  const [cpf, setCpf] = useState("");
  const [charge, setCharge] = useState<{ chargeId: string; pixPayload: string; pixQrCodeBase64: string; amount: number } | null>(null);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const branch = balances.find((b) => b.branchId === branchId) ?? home;
  const valorNumerico = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;

  function handleGerarCobranca(e: React.FormEvent) {
    e.preventDefault();
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      setErro("Digite um CPF válido (11 números).");
      return;
    }
    if (valorNumerico <= 0) {
      setErro("Digite um valor válido.");
      return;
    }
    if (!branchId) {
      setErro("Selecione a filial.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      try {
        const res = await createFortunaTopUpCharge(memberId, valorNumerico, cpfLimpo, branchId);
        setCharge(res);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  useEffect(() => {
    if (!charge || pago) return;
    const intervalo = setInterval(async () => {
      const res = await checkFortunaTopUpStatus(memberId, charge.chargeId);
      if (res.status === "pago") {
        setPago(true);
        clearInterval(intervalo);
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [charge, pago, memberId]);

  function handleCopiar() {
    if (!charge) return;
    navigator.clipboard.writeText(charge.pixPayload).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  if (pago) {
    return (
      <div className="text-left">
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Pagamento de {formatBRL(charge?.amount ?? valorNumerico)} confirmado e já creditado em{" "}
          {branch?.branchTitle}! Feche esta tela e atualize seu saldo pra conferir.
        </div>
      </div>
    );
  }

  if (charge) {
    return (
      <div className="flex flex-col items-center gap-3 text-left">
        {/* eslint-disable-next-line @next/next/no-img-element -- base64 dinâmico do Asaas, não é um asset local */}
        <img src={`data:image/png;base64,${charge.pixQrCodeBase64}`} alt="QR Code PIX" className="h-56 w-56 rounded-lg border border-gray-200" />
        <button
          onClick={handleCopiar}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-[13px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300"
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado!" : "Copiar código PIX"}
        </button>
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          <Loader2 size={12} className="animate-spin" /> Aguardando confirmação do pagamento...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleGerarCobranca} className="text-left">
      <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-[11px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
        Assim que o PIX for pago, o crédito cai automaticamente na sua carteira Fortuna.
      </div>

      <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Filial</label>
      <select
        value={branchId}
        onChange={(e) => setBranchId(Number(e.target.value))}
        className="mb-3 w-full rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      >
        {balances.map((b) => (
          <option key={b.branchId} value={b.branchId}>
            {b.branchTitle}
            {b.isHome ? " (sua unidade)" : ""} — saldo atual {formatBRL(b.amount)}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Valor</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        className="mb-3 w-full rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />

      <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">CPF de quem vai pagar</label>
      <input
        value={cpf}
        onChange={(e) => setCpf(e.target.value)}
        placeholder="000.000.000-00"
        inputMode="numeric"
        className="mb-3 w-full rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />

      {erro && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || valorNumerico <= 0}
        className="w-full rounded-xl bg-na-green px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? "Gerando cobrança..." : `Gerar PIX de ${formatBRL(valorNumerico)}`}
      </button>
    </form>
  );
}
