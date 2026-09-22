"use client";

import { checkChargeStatus, createContributionCharge } from "@/lib/actions/payment-actions";
import { viewReceiptByMercurioRecId } from "@/lib/actions/receipt-actions";
import { formatBRL } from "@/lib/format";
import type { FortunaBalanceView } from "@/lib/member-data";
import type { ContributionMonthlyStatus } from "@prisma/client";
import { AlertTriangle, Check, Coffee, Copy, CreditCard, ExternalLink, Loader2, Printer, QrCode } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

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

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function handleImprimir(rawText: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(`<pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap; margin: 0;">${escapeHtml(rawText)}</pre>`);
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => document.body.removeChild(iframe), 1000);
}

/**
 * Situação real da contribuição mês a mês, sincronizada de "Tesouraria >
 * Cadastro > Fichas" do Mercúrio (ver scripts/sync-monthly-status.ts).
 * Cada mês é clicável: PAGA abre o recibo daquele mês (mesmo fluxo de
 * "Histórico & Recibos", unificado aqui — ver viewReceiptByMercurioRecId);
 * ATRASADO/EM BRANCO abre o pagamento real via PIX (Asaas).
 */
export function ContributionStatusPanel({
  memberId,
  monthlyStatus,
  compositionTotal,
  fortunaBalances,
}: {
  memberId: string;
  monthlyStatus: ContributionMonthlyStatus[];
  compositionTotal: number;
  fortunaBalances: FortunaBalanceView[];
}) {
  const [recibo, setRecibo] = useState<string | null>(null);
  const [mesPagamento, setMesPagamento] = useState<number | null>(null);
  const [carregandoMes, setCarregandoMes] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const porMes = new Map(monthlyStatus.map((m) => [m.month, m]));
  const mesesAtrasados = monthlyStatus.filter((m) => m.status === "atrasado");

  function handleClickMes(mes: number) {
    const registro = porMes.get(mes);
    const status = registro?.status ?? "em_branco";
    setErro(null);

    if (status === "paga") {
      if (!registro?.mercurioRecId) return;
      setCarregandoMes(mes);
      startTransition(async () => {
        const res = await viewReceiptByMercurioRecId(memberId, registro.mercurioRecId!);
        setCarregandoMes(null);
        if (!res.ok) {
          setErro(res.error ?? "Falha ao buscar o comprovante.");
          return;
        }
        setRecibo(res.rawText);
      });
      return;
    }

    if (status === "atrasado" || status === "em_branco") {
      setMesPagamento(mes);
    }
  }

  if (recibo) {
    return (
      <div className="text-left">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">Comprovante</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleImprimir(recibo)}
              className="flex items-center gap-1 text-[11px] font-semibold text-na-green dark:text-emerald-400"
            >
              <Printer size={12} /> Imprimir
            </button>
            <button onClick={() => setRecibo(null)} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Voltar
            </button>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-tight whitespace-pre-wrap dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {recibo}
        </pre>
      </div>
    );
  }

  if (mesPagamento !== null) {
    return (
      <RealPaymentScreen
        memberId={memberId}
        year={porMes.get(mesPagamento)?.year ?? new Date().getFullYear()}
        mes={mesPagamento}
        amount={compositionTotal}
        podeRecarregarFortuna={fortunaBalances.length > 0}
        onVoltar={() => setMesPagamento(null)}
      />
    );
  }

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
          const clicavel = status === "paga" || status === "atrasado" || status === "em_branco";
          return (
            <button
              key={mes}
              onClick={() => clicavel && handleClickMes(mes)}
              disabled={!clicavel || (isPending && carregandoMes === mes)}
              className={`rounded-lg border p-2 text-center text-[11px] transition ${ESTILO_POR_STATUS[status]} ${
                clicavel ? "cursor-pointer hover:brightness-95" : "cursor-default"
              }`}
            >
              <div className="font-semibold">{nome}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1">
                {isPending && carregandoMes === mes ? <Loader2 size={10} className="animate-spin" /> : LABEL_POR_STATUS[status]}
              </div>
            </button>
          );
        })}
      </div>

      {erro && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {mesesAtrasados.length > 0 ? (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Clique num mês em atraso pra pagar. Meses pagos mostram o comprovante.
        </p>
      ) : (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Nenhum mês em atraso este ano.</p>
      )}
    </div>
  );
}

type ChargeResult = Awaited<ReturnType<typeof createContributionCharge>>;

const RECARGA_SUGERIDA = [0, 10, 20, 50];

/**
 * Pagamento real via PIX ou cartão de crédito (Asaas). CPF é pedido aqui e
 * enviado direto pro Asaas (nunca fica guardado no nosso banco — mesma
 * minimização já usada pra derivar a senha inicial de login a partir do CPF
 * do Mercúrio). Depois de gerar a cobrança, fica checando o status a cada
 * 5s (checkChargeStatus) até confirmar — o webhook do Asaas (mais rápido)
 * também confirma por trás quando o Portal tiver uma URL pública.
 *
 * Cartão usa o checkout hospedado pelo próprio Asaas (invoiceUrl) — nenhum
 * dado de cartão passa pelo nosso servidor. A taxa do cartão (bem maior que
 * a do PIX) é repassada ao aluno, já embutida no valor mostrado.
 *
 * `podeRecarregarFortuna` habilita o campo opcional de recarga combinada
 * (decisão do usuário 2026-09-22: aproveitar o momento em que já está
 * pagando pra sugerir também carregar o Fortuna, sem trocar de tela).
 */
function RealPaymentScreen({
  memberId,
  year,
  mes,
  amount,
  podeRecarregarFortuna,
  onVoltar,
}: {
  memberId: string;
  year: number;
  mes: number;
  amount: number;
  podeRecarregarFortuna: boolean;
  onVoltar: () => void;
}) {
  const [metodo, setMetodo] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [recargaFortuna, setRecargaFortuna] = useState(0);
  const [cpf, setCpf] = useState("");
  const [charge, setCharge] = useState<ChargeResult | null>(null);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGerarCobranca(e: React.FormEvent) {
    e.preventDefault();
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      setErro("Digite um CPF válido (11 números).");
      return;
    }
    setErro(null);
    startTransition(async () => {
      try {
        const res = await createContributionCharge(memberId, year, mes, cpfLimpo, { metodo, fortunaTopUpAmount: recargaFortuna });
        setCharge(res);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  useEffect(() => {
    if (!charge || pago) return;
    const intervalo = setInterval(async () => {
      const res = await checkChargeStatus(memberId, charge.chargeId);
      if (res.status === "pago") {
        setPago(true);
        clearInterval(intervalo);
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [charge, pago, memberId]);

  function handleCopiar() {
    if (!charge || charge.metodo !== "PIX") return;
    navigator.clipboard.writeText(charge.pixPayload).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  const totalCobrado = charge?.totalCobrado ?? amount + recargaFortuna;

  return (
    <div className="text-left">
      <button onClick={onVoltar} className="mb-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        ← Voltar
      </button>

      <div className="mb-4 rounded-xl border border-gray-200 p-4 text-center dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">Contribuição de {MESES[mes - 1]}</p>
        <p className="mt-1 text-2xl font-bold text-na-green-dark dark:text-emerald-400">{formatBRL(totalCobrado)}</p>
        {totalCobrado !== amount && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {formatBRL(amount)} de contribuição
            {recargaFortuna > 0 && ` + ${formatBRL(recargaFortuna)} de recarga Fortuna`}
            {charge?.metodo === "CREDIT_CARD" && charge.totalCobrado > amount + recargaFortuna && " + taxa do cartão"}
          </p>
        )}
      </div>

      {pago ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Pagamento confirmado! O lançamento no Mercúrio foi disparado automaticamente
          {recargaFortuna > 0 && ", e a recarga no Fortuna também."}
        </div>
      ) : charge?.metodo === "PIX" ? (
        <div className="flex flex-col items-center gap-3">
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
      ) : charge?.metodo === "CREDIT_CARD" ? (
        <div className="flex flex-col items-center gap-3">
          <a
            href={charge.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-na-green-dark"
          >
            <ExternalLink size={14} /> Ir para pagamento seguro (Asaas)
          </a>
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
            Seus dados de cartão são digitados direto no ambiente seguro do Asaas — nunca passam pelo Portal.
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            <Loader2 size={12} className="animate-spin" /> Aguardando confirmação do pagamento...
          </p>
        </div>
      ) : (
        <form onSubmit={handleGerarCobranca} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMetodo("PIX")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${
                metodo === "PIX"
                  ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400"
                  : "border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              <QrCode size={14} /> PIX
            </button>
            <button
              type="button"
              onClick={() => setMetodo("CREDIT_CARD")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${
                metodo === "CREDIT_CARD"
                  ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400"
                  : "border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              <CreditCard size={14} /> Cartão de crédito
            </button>
          </div>
          {metodo === "CREDIT_CARD" && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              No cartão, o valor sai um pouco maior — cobre a taxa do Asaas (o PIX não tem essa taxa extra).
            </p>
          )}

          {podeRecarregarFortuna && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                <Coffee size={13} /> Aproveite e recarregue o Fortuna junto (evita fila na lanchonete)
              </p>
              <div className="flex gap-1.5">
                {RECARGA_SUGERIDA.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRecargaFortuna(v)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                      recargaFortuna === v
                        ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                        : "border-amber-200 bg-white text-amber-700 dark:border-amber-900 dark:bg-transparent dark:text-amber-400"
                    }`}
                  >
                    {v === 0 ? "Não" : `+${formatBRL(v)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">CPF de quem vai pagar</label>
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className="rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          {erro && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-na-green px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
          >
            {isPending ? "Gerando cobrança..." : `Pagar ${formatBRL(amount + recargaFortuna)}${metodo === "CREDIT_CARD" ? " + taxa" : ""}`}
          </button>
        </form>
      )}
    </div>
  );
}
