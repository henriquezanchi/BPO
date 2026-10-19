"use client";

import { usePaymentPolling } from "@/hooks/use-payment-polling";
import { PaymentStatus } from "@/components/ui/payment-status";

import { contributionPosition } from "@/lib/contribution-position";
import { oldestOpenContribution, periodNumber, type ChargeLedger } from "@/lib/contribution-order";
import { CopyButton } from "@/components/ui/copy-button";

import { getFortunaRecorrenteNudge, responderNudge } from "@/lib/actions/nudge-actions";
import { ativarPixAutomatico, checkPixAutomaticoStatus, desativarPixAutomatico } from "@/lib/actions/pix-automatico-actions";
import { cancelarCobrancaContribuicaoPendente, checkChargeStatus, createContributionCharge, getPendingContributionCharge } from "@/lib/actions/payment-actions";
import { viewReceiptByMercurioRecId } from "@/lib/actions/receipt-actions";
import { formatBRL } from "@/lib/format";
import { mensagemErroAmigavel } from "@/lib/friendly-error";
import type { FortunaBalanceView } from "@/lib/member-data";
import type { ContributionMonthlyStatus } from "@prisma/client";
import { gerarPdfRecibo } from "@/lib/recibo-pdf";
import { situacaoDoMes } from "@/lib/situacao-contribuicao";
import { AlertTriangle, Coffee, CreditCard, Download, ExternalLink, HeartHandshake, Loader2, QrCode, RefreshCw, Zap } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ESTILO_POR_STATUS: Record<string, string> = {
  paga: "border-na-success/40 bg-na-success-light text-na-success-dark dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  atrasado: "border-na-danger/40 bg-na-danger-light text-na-danger-dark dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
  isento: "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
  em_branco: "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500",
  // Mês atual sem pagamento depois do dia 10: perdeu o desconto, mas não está em atraso (amarelo).
  sem_desconto: "border-na-warning/40 bg-na-warning-light text-na-warning-dark dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
};

const LABEL_POR_STATUS: Record<string, string> = {
  paga: "Paga",
  atrasado: "Em atraso",
  isento: "Isento",
  em_branco: "—",
  sem_desconto: "Sem desconto",
};

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
  confirmedCharges = [],
  compositionTotal,
  fortunaBalances,
  pixAutomaticStatus,
  somenteConsulta,
}: {
  memberId: string;
  monthlyStatus: ContributionMonthlyStatus[];
  confirmedCharges?: ChargeLedger[];
  compositionTotal: number;
  fortunaBalances: FortunaBalanceView[];
  pixAutomaticStatus: string | null;
  somenteConsulta?: boolean;
}) {
  const [recibo, setRecibo] = useState<{ recId: string; texto: string } | null>(null);
  const [mesPagamento, setMesPagamento] = useState<number | null>(null);
  const [carregandoMes, setCarregandoMes] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [confirmedLocally, setConfirmedLocally] = useState<ChargeLedger[]>([]);
  const payments = [...confirmedCharges, ...confirmedLocally];
  const firstOpen = oldestOpenContribution(monthlyStatus, payments);
  const position = contributionPosition(monthlyStatus, payments);
  const overdue = position.filter(row=>row.overdue);
  const received = position.filter(row=>row.received);
  const latestSync = monthlyStatus.reduce<Date | null>((latest,row)=>!latest || new Date(row.syncedAt)>latest ? new Date(row.syncedAt) : latest, null);
  const years = [...new Set([new Date().getFullYear(), ...monthlyStatus.map(item=>item.year), ...payments.map(item=>item.referenceYear)])].sort((a,b)=>a-b);
  const porMes = new Map(monthlyStatus.filter(m=>m.year===selectedYear).map((m) => [m.month, m]));
  const mesesAtrasados = monthlyStatus.filter((m) => m.year===selectedYear && m.status === "atrasado");

  function handleClickMes(mes: number) {
    const registro = porMes.get(mes);
    const paid = payments.some(item=>item.referenceYear===selectedYear&&item.referenceMonth===mes&&item.status==="pago");
    const status = paid ? "paga" : registro?.status ?? "em_branco";
    setErro(null);

    if (status === "paga") {
      if (!registro?.mercurioRecId) { setErro(paid ? "Recebimento confirmado pelo Portal. O comprovante da escola ainda não está disponível; não é necessário pagar novamente." : "Pagamento registrado. O comprovante ainda não está disponível; peça a conferência à escola."); return; }
      setCarregandoMes(mes);
      startTransition(async () => {
        const res = await viewReceiptByMercurioRecId(memberId, registro.mercurioRecId!);
        setCarregandoMes(null);
        if (!res.ok) {
          setErro(res.error ?? "Falha ao buscar o comprovante.");
          return;
        }
        setRecibo({recId:registro.mercurioRecId!,texto:res.rawText});
      });
      return;
    }

    if (!somenteConsulta && (status === "atrasado" || status === "em_branco")) {
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
              onClick={() => gerarPdfRecibo(recibo.texto).save(`comprovante-${recibo.recId}.pdf`)}
              className="flex items-center gap-1 text-[11px] font-semibold text-na-green dark:text-emerald-400"
            >
              <Download size={12} /> Baixar PDF
            </button>
            <button onClick={() => setRecibo(null)} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Voltar
            </button>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-tight whitespace-pre-wrap dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {recibo.texto}
        </pre>
      </div>
    );
  }

  if (mesPagamento !== null) {
    return (
      <RealPaymentScreen
        memberId={memberId}
        year={porMes.get(mesPagamento)?.year ?? selectedYear}
        mes={mesPagamento}
        amount={compositionTotal}
        podeRecarregarFortuna={fortunaBalances.length > 0}
        onConfirmed={() => setConfirmedLocally(items=>[...items,{referenceYear:selectedYear,referenceMonth:mesPagamento,status:"pago"}])}
        onVoltar={() => setMesPagamento(null)}
      />
    );
  }

  return (
    <div className="text-left">
      {!somenteConsulta && <PixAutomaticoBanner memberId={memberId} status={pixAutomaticStatus} />}

      <section aria-label="Resumo das contribuições" className="my-4 space-y-2 border-y border-gray-200 py-4 text-sm dark:border-gray-700">
        <h3 className="font-bold text-na-green-dark dark:text-na-green-light">Suas contribuições</h3>
        <p>{overdue.length ? `${overdue.length} competência(s) registrada(s) em atraso.` : monthlyStatus.length ? "Nenhum atraso nos registros disponíveis." : "Ainda não temos a situação da escola para consulta."}</p>
        {!!received.length && <p>{received.length} pagamento(s) confirmado(s) pelo Portal. O registro na escola pode levar mais tempo.</p>}
        <p className="text-xs text-gray-600 dark:text-gray-300">{latestSync ? `Última atualização de um registro: ${latestSync.toLocaleString("pt-BR")}.` : "Sem data de atualização disponível."} Não são cobrados juros sobre as contribuições.</p>
        <p className="text-xs text-gray-600 dark:text-gray-300">O valor atual da composição não é usado para estimar valores de meses anteriores. Se você já pagou na escola e isso não aparece, peça a conferência antes de pagar novamente.</p>
      </section>

      <label className="mb-3 flex items-center gap-2 text-sm">Ano<select aria-label="Ano das contribuições" value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} className="min-h-11 rounded-lg border border-gray-300 p-2 dark:bg-gray-800">{years.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
      {firstOpen && <button type="button" onClick={()=>setSelectedYear(firstOpen.year)} className="mb-2 min-h-11 text-sm font-semibold text-na-green-dark dark:text-na-green-light">Ir para a contribuição mais antiga em aberto</button>}
      {firstOpen && <p className="mb-3 text-xs text-na-warning-dark dark:text-na-warning-light">Regularize primeiro {String(firstOpen.month).padStart(2,"0")}/{firstOpen.year}. Meses posteriores ficam bloqueados enquanto houver contribuição anterior em aberto.</p>}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {MESES.map((nome, i) => {
          const mes = i + 1;
          const registro = porMes.get(mes);
          const paid = payments.some(item=>item.referenceYear===selectedYear&&item.referenceMonth===mes&&item.status==="pago");
          const statusBase = paid ? "paga" : registro?.status ?? "em_branco";
          // Regra do desconto até o dia 10 (situacao-contribuicao.ts): mês atual em aberto vira amarelo; mês encerrado sem pagamento, vermelho.
          const situacaoMes = registro ? situacaoDoMes(statusBase, registro.year, mes) : null;
          const status = statusBase === "em_branco" && situacaoMes === "sem_desconto" ? "sem_desconto" : statusBase === "em_branco" && situacaoMes === "em_atraso" ? "atrasado" : statusBase;
          const blocked = !!firstOpen && periodNumber({year:registro?.year??selectedYear,month:mes}) > periodNumber(firstOpen);
          const clicavel = status === "paga" || (!somenteConsulta && !blocked && !!registro && (status === "atrasado" || status === "em_branco" || status === "sem_desconto"));
          return (
            <button
              key={mes}
              onClick={() => clicavel && handleClickMes(mes)}
              title={blocked && status!=="paga" ? `Regularize primeiro ${firstOpen?.month}/${firstOpen?.year}` : undefined}
              disabled={!clicavel || (isPending && carregandoMes === mes)}
              className={`rounded-lg border p-2 text-center text-[11px] transition ${ESTILO_POR_STATUS[status]} ${
                clicavel ? "cursor-pointer hover:brightness-95" : "cursor-default"
              }`}
            >
              <div className="font-semibold">{nome}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1">
                {isPending && carregandoMes === mes ? <Loader2 size={10} className="animate-spin" /> : paid ? "Recebido" : registro ? LABEL_POR_STATUS[status] : "Sem dados"}
              </div>
            </button>
          );
        })}
      </div>

      {erro && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-na-danger-light p-3 text-[11px] text-na-danger-dark dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {somenteConsulta ? (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Online payment isn&apos;t available for your branch yet — please contact your branch.</p>
      ) : mesesAtrasados.length > 0 ? (
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
  onConfirmed,
}: {
  memberId: string;
  year: number;
  mes: number;
  amount: number;
  podeRecarregarFortuna: boolean;
  onVoltar: () => void;
  onConfirmed: () => void;
}) {
  const [metodo, setMetodo] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [recargaFortuna, setRecargaFortuna] = useState(0);
  const [cpf, setCpf] = useState("");
  const [charge, setCharge] = useState<ChargeResult | null>(null);
  const [verificandoPendente, setVerificandoPendente] = useState(true);
  const [falhaPendente, setFalhaPendente] = useState(false);
  const [tentativaPendente, setTentativaPendente] = useState(0);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fortunaNudge, setFortunaNudge] = useState<Awaited<ReturnType<typeof getFortunaRecorrenteNudge>>>(null);
  const [respondendoNudge, setRespondendoNudge] = useState(false);

  // Bug real relatado pelo usuário 2026-09-22: sair da tela no meio do
  // pagamento (ex: recebeu uma ligação) deixava a cobrança pendente órfã no
  // Asaas — voltar e clicar em "pagar outubro" de novo criava uma 2ª
  // cobrança, arriscando cobrar o aluno duas vezes. Antes de mostrar o
  // formulário, checa se já existe uma pendente e volta direto pra ela.
  useEffect(() => {
    let active = true;
    getPendingContributionCharge(memberId, year, mes)
      .then((res) => { if (active) { if (res) setCharge(res); setFalhaPendente(false); } })
      .catch((error) => { if (active) { setFalhaPendente(true); setErro(mensagemErroAmigavel(error)); } })
      .finally(() => { if (active) setVerificandoPendente(false); });
    return () => { active = false; };
  }, [memberId, year, mes, tentativaPendente]);

  // Pop-up do crédito recorrente Fortuna na hora de pagar — pedido do
  // usuário 2026-10-09: não fica mais fixo na Home, só aparece aqui pra
  // quem ainda não tem o item registrado (ver getFortunaRecorrenteNudge).
  useEffect(() => {
    if (podeRecarregarFortuna) getFortunaRecorrenteNudge(memberId).then(setFortunaNudge).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function responderFortunaNudge(resposta: "sim" | "depois" | "nao", valor?: number) {
    if (!fortunaNudge) return;
    setRespondendoNudge(true);
    startTransition(async () => {
      await responderNudge(memberId, fortunaNudge.id, resposta, valor);
      setRespondendoNudge(false);
      setFortunaNudge(null);
    });
  }

  function handleCancelarEGerarNova() {
    if (!charge) return;
    if (!confirm("Cancelar essa cobrança e gerar uma nova? A cobrança antiga deixa de valer.")) return;
    startTransition(async () => {
      await cancelarCobrancaContribuicaoPendente(memberId, charge.chargeId);
      setCharge(null);
    });
  }

  function handleGerarCobranca(e: React.FormEvent) {
    e.preventDefault();
    if (verificandoPendente || falhaPendente || isPending) return;
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
        setErro(mensagemErroAmigavel(e));
      }
    });
  }

  const polling = usePaymentPolling(charge && !pago ? `${memberId}:${charge.chargeId}` : null, () => checkChargeStatus(memberId, charge!.chargeId), (res) => { if (res.status !== "pago") return false; setPago(true); onConfirmed(); return true; });



  const recargaEfetiva = charge?.fortunaTopUpAmount ?? recargaFortuna;
  const totalCobrado = charge?.totalCobrado ?? amount + recargaFortuna;

  return (
    <div className="text-left">
      {fortunaNudge && !verificandoPendente && !falhaPendente && !charge && !pago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-sm flex-col gap-2.5 rounded-2xl border border-na-gold/40 bg-white p-4 dark:bg-gray-900">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-na-gold/20 text-na-gold-dark">
                <HeartHandshake size={16} />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{fortunaNudge.titulo}</h3>
                <p className="text-[12px] text-gray-600 dark:text-gray-400">{fortunaNudge.descricao}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {fortunaNudge.opcoes.map((opcao) => (
                <button
                  key={opcao.label}
                  onClick={() => responderFortunaNudge("sim", opcao.valor)}
                  disabled={respondendoNudge}
                  className="rounded-lg bg-na-green px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
                >
                  {respondendoNudge ? <Loader2 size={13} className="animate-spin" /> : fortunaNudge.opcoes.length === 1 ? "Sim" : opcao.label}
                </button>
              ))}
              <button
                onClick={() => responderFortunaNudge("depois")}
                disabled={respondendoNudge}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Lembrar mês que vem
              </button>
              <button
                onClick={() => responderFortunaNudge("nao")}
                disabled={respondendoNudge}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={onVoltar} className="mb-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        ← Voltar
      </button>

      <div className="mb-4 rounded-xl border border-gray-200 p-4 text-center dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">Contribuição de {MESES[mes - 1]}/{year}</p>
        <p className="mt-1 text-2xl font-bold text-na-green-dark dark:text-emerald-400">{formatBRL(totalCobrado)}</p>
        {!pago && (
          <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            Pelo Portal, sua contribuição é atualizada assim que o pagamento é confirmado.
          </p>
        )}
        {totalCobrado !== amount && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {formatBRL(amount)} de contribuição
            {recargaEfetiva > 0 && ` + ${formatBRL(recargaEfetiva)} de recarga Fortuna`}
            {charge?.metodo === "CREDIT_CARD" && charge.totalCobrado > amount + recargaEfetiva && " + taxa do cartão"}
          </p>
        )}
      </div>

      {verificandoPendente ? (
        <p className="flex items-center justify-center gap-1.5 py-10 text-center text-[11px] text-gray-400 dark:text-gray-500">
          <Loader2 size={12} className="animate-spin" /> Verificando se já existe uma cobrança pendente...
        </p>
      ) : falhaPendente ? (
        <div role="alert" className="rounded-xl bg-na-warning-light p-4 text-sm text-na-warning-dark dark:bg-na-warning-dark/30 dark:text-na-warning-light">
          <p>{erro}</p>
          <p>Não foi possível verificar se já existe uma cobrança. Para evitar um pagamento duplicado, consulte novamente antes de gerar outro código.</p>
          <button type="button" onClick={() => { setVerificandoPendente(true); setFalhaPendente(false); setTentativaPendente((value) => value + 1); }} className="mt-3 min-h-11 rounded-lg border border-current px-3 font-semibold">Verificar cobrança existente</button>
        </div>
      ) : pago ? (
        <div className="rounded-xl border border-na-success/40 bg-na-success-light p-4 text-center text-sm text-na-success-dark dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Pagamento confirmado! O lançamento no Mercúrio foi disparado automaticamente
          {recargaEfetiva > 0 && ", e a recarga no Fortuna também."}
        </div>
      ) : charge?.metodo === "PIX" ? (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 dinâmico do Asaas, não é um asset local */}
          <img src={`data:image/png;base64,${charge.pixQrCodeBase64}`} alt="QR Code PIX" className="h-56 w-56 rounded-lg border border-gray-200" />
          <CopyButton key={charge.pixPayload} value={charge.pixPayload} />
          <PaymentStatus state={polling.state} onRetry={polling.retry} />
          <button onClick={handleCancelarEGerarNova} disabled={isPending} className="text-[11px] font-semibold text-gray-400 underline hover:text-gray-600 dark:hover:text-gray-300">
            Cancelar essa cobrança e gerar outra
          </button>
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
          <PaymentStatus state={polling.state} onRetry={polling.retry} />
          <button onClick={handleCancelarEGerarNova} disabled={isPending} className="text-[11px] font-semibold text-gray-400 underline hover:text-gray-600 dark:hover:text-gray-300">
            Cancelar essa cobrança e gerar outra
          </button>
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
            <div className="rounded-lg border border-na-warning/30 bg-na-warning-light p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-na-warning-dark dark:text-amber-300">
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
                        ? "border-na-warning bg-na-warning-light text-na-warning-dark dark:bg-amber-900/40 dark:text-amber-200"
                        : "border-na-warning/40 bg-white text-na-warning-dark dark:border-amber-900 dark:bg-transparent dark:text-amber-400"
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
            <div className="flex items-start gap-2 rounded-lg bg-na-danger-light p-2.5 text-[11px] text-na-danger-dark dark:bg-red-950/30 dark:text-red-300">
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

/**
 * Débito automático de verdade (Pix Automático, Asaas) — decisão do
 * usuário 2026-09-22: vira o padrão SUGERIDO (banner sempre visível quando
 * não ativado), pra não depender do aluno lembrar de pagar todo mês. Uma
 * vez ativo, a cobrança de cada mês é criada sozinha pelo worker (ver
 * scripts/process-pix-automatico.ts) — nenhuma ação do aluno depois disso.
 */
function PixAutomaticoBanner({ memberId, status }: { memberId: string; status: string | null }) {
  const [statusAtual, setStatusAtual] = useState(status);
  const [ativando, setAtivando] = useState(false);
  const [cpf, setCpf] = useState("");
  const [autorizacao, setAutorizacao] = useState<{ payload?: string; encodedImage?: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const polling = usePaymentPolling(autorizacao && statusAtual !== "ACTIVE" ? memberId : null,
    () => checkPixAutomaticoStatus(memberId), (res) => {
      if (res.status !== "ACTIVE") return false;
      setStatusAtual("ACTIVE"); setAutorizacao(null); return true;
    });

  function handleAtivar(e: React.FormEvent) {
    e.preventDefault();
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      setErro("Digite um CPF válido (11 números).");
      return;
    }
    setErro(null);
    startTransition(async () => {
      try {
        const res = await ativarPixAutomatico(memberId, cpfLimpo);
        setAutorizacao(res);
      } catch (e) {
        setErro(mensagemErroAmigavel(e));
      }
    });
  }

  function handleDesativar() {
    if (!confirm("Desativar o débito automático? Você volta a precisar pagar manualmente todo mês.")) return;
    startTransition(async () => {
      await desativarPixAutomatico(memberId);
      setStatusAtual("CANCELLED");
    });
  }

  if (statusAtual === "ACTIVE") {
    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border border-na-success/30 bg-na-success-light p-3 text-[11px] dark:border-emerald-900 dark:bg-emerald-950/30">
        <span className="flex items-center gap-1.5 font-semibold text-na-success-dark dark:text-emerald-300">
          <Zap size={13} /> Débito automático ativo — sua contribuição é cobrada sozinha todo mês.
        </span>
        <button onClick={handleDesativar} disabled={isPending} className="shrink-0 font-semibold text-gray-400 underline hover:text-gray-600 dark:hover:text-gray-300">
          Desativar
        </button>
      </div>
    );
  }

  if (autorizacao?.encodedImage) {
    return (
      <div className="mb-4 flex flex-col items-center gap-2 rounded-lg border border-na-warning/30 bg-na-warning-light p-3 text-center dark:border-amber-900 dark:bg-amber-950/30">
        <p className="text-[11px] font-semibold text-na-warning-dark dark:text-amber-300">Escaneie pra confirmar — esse pagamento também autoriza os próximos meses</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- base64 dinâmico do Asaas */}
        <img src={`data:image/png;base64,${autorizacao.encodedImage}`} alt="QR Code Pix Automático" className="h-40 w-40 rounded-lg border border-gray-200" />
        <PaymentStatus state={polling.state} onRetry={polling.retry} />
      </div>
    );
  }

  if (ativando) {
    return (
      <form onSubmit={handleAtivar} className="mb-4 flex flex-col gap-2 rounded-lg border border-na-warning/30 bg-na-warning-light p-3 dark:border-amber-900 dark:bg-amber-950/30">
        <label className="text-[11px] font-semibold text-na-warning-dark dark:text-amber-300">CPF de quem vai pagar</label>
        <input
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="000.000.000-00"
          inputMode="numeric"
          className="rounded-lg border border-na-warning/50 bg-white p-2 text-sm dark:border-amber-800 dark:bg-gray-900"
        />
        {erro && <span className="text-[11px] text-na-danger-dark dark:text-red-400">{erro}</span>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-lg bg-na-warning px-3 py-2 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? "Gerando..." : "Gerar autorização"}
          </button>
          <button type="button" onClick={() => setAtivando(false)} className="rounded-lg border border-na-warning/50 px-3 py-2 text-[11px] font-semibold text-na-warning-dark dark:text-amber-300">
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      onClick={() => setAtivando(true)}
      className="mb-4 flex w-full items-center gap-2 rounded-lg border border-na-warning/30 bg-na-warning-light p-3 text-left text-[11px] transition hover:brightness-95 dark:border-amber-900 dark:bg-amber-950/30"
    >
      <RefreshCw size={14} className="shrink-0 text-na-warning-dark dark:text-amber-400" />
      <span className="text-na-warning-dark dark:text-amber-300">
        <span className="font-semibold">Ative o débito automático</span> — nunca mais esqueça de pagar. Autoriza uma vez, cobramos sozinhos todo mês.
      </span>
    </button>
  );
}
