"use client";

import { checkChargeStatus, createContributionCharge, getPendingContributionCharge } from "@/lib/actions/payment-actions";
import { mensagemErroAmigavel } from "@/lib/friendly-error";
import { Check, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Passo a passo do pagamento guiado (/pagar, 12/11/2026). A tela anda sozinha: mostra a contribuição, gera o Pix e
 * espera a confirmação do banco. A pessoa só toca em "Copiar o código" e confirma no app do banco; o CPF de quem paga
 * é pedido só na primeira vez.
 */
type Cobranca = Awaited<ReturnType<typeof createContributionCharge>>;
type Etapa = "contribuicao" | "cpf" | "gerando" | "pix" | "pago" | "erro";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ESPERA_CONTRIBUICAO_MS = 2500;

export function PagamentoGuiado(p: {
  memberId: string;
  nome: string;
  alvo: { year: number; month: number } | null;
  itens: { rotulo: string; valor: number }[];
  temPagadorSalvo: boolean;
  cartaoComTaxa: boolean;
}) {
  const [etapa, setEtapa] = useState<Etapa>("contribuicao");
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const iniciou = useRef(false);
  const total = p.itens.reduce((s, i) => s + i.valor, 0);
  const mes = p.alvo ? `${MESES[p.alvo.month - 1]} de ${p.alvo.year}` : "";

  const gerar = useCallback(
    async (cpfDigitado: string) => {
      if (!p.alvo) return;
      setEtapa("gerando");
      setErro("");
      try {
        const existente = await getPendingContributionCharge(p.memberId, p.alvo.year, p.alvo.month);
        const c = existente ?? (await createContributionCharge(p.memberId, p.alvo.year, p.alvo.month, cpfDigitado, { metodo: "PIX" }));
        setCobranca(c);
        setEtapa("pix");
      } catch (e) {
        const msg = mensagemErroAmigavel(e);
        // Pagador salvo não serviu (ex.: mudou de filial): pede o CPF em vez de parar.
        if (/CPF/i.test(msg) && !cpfDigitado) {
          setEtapa("cpf");
          return;
        }
        setErro(msg);
        setEtapa("erro");
      }
    },
    [p.alvo, p.memberId],
  );

  // Passo 1 → 2 sozinho: depois de mostrar a contribuição, gera o Pix (ou pede o CPF na primeira vez).
  useEffect(() => {
    if (!p.alvo || total <= 0 || iniciou.current) return;
    const t = setTimeout(() => {
      iniciou.current = true;
      if (p.temPagadorSalvo) void gerar("");
      else setEtapa("cpf");
    }, ESPERA_CONTRIBUICAO_MS);
    return () => clearTimeout(t);
  }, [p.alvo, p.temPagadorSalvo, total, gerar]);

  // Espera a confirmação do banco (o webhook do Asaas atualiza; a consulta é o plano B).
  useEffect(() => {
    if (etapa !== "pix" || !cobranca) return;
    let ativo = true;
    const inicio = Date.now();
    const tick = async () => {
      if (!ativo || Date.now() - inicio > 15 * 60_000) return;
      const r = await checkChargeStatus(p.memberId, cobranca.chargeId).catch(() => null);
      if (!ativo) return;
      if (r?.status === "pago") setEtapa("pago");
      else setTimeout(tick, 5000);
    };
    const t = setTimeout(tick, 5000);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [etapa, cobranca, p.memberId]);

  const copiar = async () => {
    if (!cobranca || cobranca.metodo !== "PIX") return;
    try {
      await navigator.clipboard.writeText(cobranca.pixPayload);
      setCopiado(true);
    } catch {
      setCopiado(false);
      document.getElementById("pix-codigo")?.focus();
    }
  };

  if (!p.alvo)
    return (
      <Cartao titulo={`Tudo em dia, ${p.nome}!`}>
        <p className="text-sm text-gray-600 dark:text-gray-400">Não há contribuição em aberto no seu nome. Obrigado!</p>
        <Link href="/portal" className="text-sm font-semibold text-na-green underline dark:text-emerald-400">Ir para o Portal</Link>
      </Cartao>
    );
  if (total <= 0)
    return (
      <Cartao titulo="Composição vazia">
        <p className="text-sm text-gray-600 dark:text-gray-400">A sua contribuição ainda não tem composição cadastrada. Fale com a Economia da sua filial.</p>
      </Cartao>
    );

  const passo = { contribuicao: 1, cpf: 2, gerando: 2, erro: 2, pix: 3, pago: 4 }[etapa];
  return (
    <div className="grid gap-4">
      <ol className="flex gap-1.5" aria-label={`Passo ${passo} de 4`}>
        {[1, 2, 3, 4].map((n) => (
          <li key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= passo ? "bg-na-green" : "bg-gray-200 dark:bg-gray-800"}`} />
        ))}
      </ol>

      <Cartao titulo={`Olá, ${p.nome}! Esta é a sua contribuição de ${mes}`}>
        <ul className="grid gap-1 text-sm">
          {p.itens.map((i) => (
            <li key={i.rotulo} className="flex justify-between gap-3 text-gray-700 dark:text-gray-300">
              <span className="min-w-0">{i.rotulo}</span>
              <span className="tabular-nums">{brl(i.valor)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-gray-200 pt-2 text-base font-black dark:border-gray-800">
          <span>Total</span>
          <span className="tabular-nums">{brl(total)}</span>
        </p>
        {etapa === "contribuicao" && (
          <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Preparando o seu Pix…
          </p>
        )}
      </Cartao>

      {etapa === "cpf" && (
        <Cartao titulo="Só desta vez: CPF de quem vai pagar">
          <p className="text-sm text-gray-600 dark:text-gray-400">O banco pede o CPF de quem paga. Nas próximas vezes o Portal já lembra.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const limpo = cpf.replace(/\D/g, "");
              if (limpo.length !== 11) return setErro("Digite os 11 números do CPF.");
              void gerar(limpo);
            }}
          >
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="000.000.000-00"
              aria-label="CPF de quem vai pagar"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base tabular-nums dark:border-gray-700 dark:bg-gray-950"
            />
            <button type="submit" className="min-h-11 rounded-xl bg-na-green px-4 font-bold text-white">Gerar Pix</button>
          </form>
          {erro && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{erro}</p>}
        </Cartao>
      )}

      {etapa === "gerando" && (
        <p className="flex items-center gap-2 px-1 text-sm text-gray-600 dark:text-gray-400" role="status">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Gerando o Pix…
        </p>
      )}

      {etapa === "erro" && (
        <Cartao titulo="Não deu para gerar o Pix">
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">{erro}</p>
          <button type="button" onClick={() => void gerar(cpf.replace(/\D/g, ""))} className="min-h-11 rounded-xl bg-na-green px-4 font-bold text-white">Tentar de novo</button>
          <Link href="/portal?abrir=pagar" className="text-sm font-semibold text-na-green underline dark:text-emerald-400">Pagar pelo Portal</Link>
        </Cartao>
      )}

      {etapa === "pix" && cobranca?.metodo === "PIX" && (
        <Cartao titulo="Agora é com o app do seu banco">
          <ol className="grid list-decimal gap-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>Toque em <b>Copiar o código</b>.</li>
            <li>Abra o app do seu banco e entre em <b>Pix → Pix Copia e Cola</b>.</li>
            <li>Cole o código, confira o valor de <b>{brl(cobranca.totalCobrado)}</b> e confirme.</li>
          </ol>
          <button type="button" onClick={copiar} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-na-green px-4 text-base font-bold text-white">
            {copiado ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
            {copiado ? "Código copiado" : "Copiar o código"}
          </button>
          <textarea
            id="pix-codigo"
            readOnly
            value={cobranca.pixPayload}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Código Pix Copia e Cola"
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400"
          />
          <details className="text-sm text-gray-600 dark:text-gray-400">
            <summary className="cursor-pointer font-semibold">Vai pagar por outro celular? Mostrar o QR code</summary>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${cobranca.pixQrCodeBase64}`} alt="QR code do Pix" className="mx-auto mt-2 size-56" />
          </details>
          <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Esperando a confirmação do banco. Pode deixar esta tela aberta.
          </p>
        </Cartao>
      )}

      {etapa === "pix" && cobranca?.metodo === "CREDIT_CARD" && (
        <Cartao titulo="Você já começou este pagamento no cartão">
          <a href={cobranca.invoiceUrl} className="min-h-11 rounded-xl bg-na-green px-4 py-3 text-center font-bold text-white">Continuar no cartão</a>
        </Cartao>
      )}

      {etapa === "pago" && (
        <Cartao titulo={`Pagamento confirmado. Obrigado, ${p.nome}!`}>
          <p className="text-sm text-gray-600 dark:text-gray-400">O recibo aparece no Portal assim que a secretaria registrar. Para não precisar lembrar todo mês, ative o débito automático por Pix no Portal.</p>
          <Link href="/portal" className="min-h-11 rounded-xl bg-na-green px-4 py-3 text-center font-bold text-white">Ir para o Portal</Link>
        </Cartao>
      )}

      {(etapa === "pix" || etapa === "cpf") && (
        <Link href="/portal?abrir=pagar" className="text-center text-sm text-gray-500 underline">
          Prefiro pagar no cartão{p.cartaoComTaxa ? " (com a taxa do cartão)" : ""}
        </Link>
      )}
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
      <h1 className="text-lg font-black text-balance text-gray-900 dark:text-gray-100">{titulo}</h1>
      {children}
    </section>
  );
}
