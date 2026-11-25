"use client";

import { cancelarCompraCafe, comprarNoCafe } from "@/lib/actions/cafe-actions";
import { fotoDoProduto } from "@/lib/cafe-fotos";
import type { FortunaProduto, FortunaVendaResultado } from "@/lib/fortuna/client";
import { CircleCheck, Loader2, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

/**
 * Autoatendimento na lanchonete (23/11/2026): escolhe, toca em "Pagar" e pega o produto. Um toque basta (decisão do
 * usuário); a chave do pedido evita cobrar duas vezes se o toque se repetir ou a rede cair.
 */
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const novaChave = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);

type Resultado = { ok: true; venda: FortunaVendaResultado } | { ok: false; error: string };

export function CafeAutoatendimento(p: {
  cashierId: number;
  caixa: string;
  produtos: FortunaProduto[];
  saldo: number | null;
  nome: string;
  demo?: boolean;
  /** Quiosque (23/11/2026): como comprar e cancelar (com a sessão do aluno), voltar ao começo e tela grande. */
  comprar?: (itens: { productId: number; amount: number }[], chave: string) => Promise<Resultado>;
  cancelar?: (invoiceId: number) => Promise<{ ok: boolean; error?: string }>;
  aoTerminar?: () => void;
  quiosque?: boolean;
}) {
  const [qtd, setQtd] = useState<Record<number, number>>({});
  const [chave, setChave] = useState(novaChave);
  const [venda, setVenda] = useState<FortunaVendaResultado | null>(null);
  const [cancelada, setCancelada] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  const itens = useMemo(() => Object.entries(qtd).filter(([, n]) => n > 0).map(([id, n]) => ({ productId: Number(id), amount: n })), [qtd]);
  const total = itens.reduce((s, i) => s + Number(p.produtos.find((x) => x.id === i.productId)?.price ?? 0) * i.amount, 0);
  const falta = p.saldo !== null && total > p.saldo;

  // Demonstração: mesma tela e mesmo comprovante, sem chamar o Fortuna.
  const simular = (): { ok: true; venda: FortunaVendaResultado } => {
    const linhas = itens.map((i) => {
      const x = p.produtos.find((y) => y.id === i.productId)!;
      return { productId: x.id, title: x.title, amount: i.amount, unitPrice: x.price, value: (Number(x.price) * i.amount).toFixed(2) };
    });
    return {
      ok: true,
      venda: { invoiceId: 1000 + (parseInt(chave.slice(0, 5), 36) % 9000), saleDate: new Date().toISOString(), cashier: { id: 0, title: p.caixa, branchId: 0 }, items: linhas, total: total.toFixed(2), balance: ((p.saldo ?? 0) - total).toFixed(2) },
    };
  };
  const mudar = (id: number, delta: number, max: number) => setQtd((q) => ({ ...q, [id]: Math.max(0, Math.min(max, (q[id] ?? 0) + delta)) }));

  if (venda)
    return (
      <div className="grid gap-4">
        <section className={`grid gap-3 rounded-3xl p-6 text-center ${cancelada ? "bg-gray-100 dark:bg-gray-800" : "bg-emerald-600 text-white"}`} aria-live="polite">
          {!cancelada && <CircleCheck className="mx-auto size-16" aria-hidden />}
          <h1 className="text-3xl font-black">{cancelada ? "Compra cancelada" : "Pago. Pode pegar!"}</h1>
          <p className={cancelada ? "text-gray-600 dark:text-gray-400" : "text-emerald-50"}>
            {cancelada ? "O valor voltou para o seu saldo." : `${p.nome} · ${venda.cashier.title} · ${new Date(venda.saleDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`}
          </p>
          <ul className="grid gap-1 text-left text-lg">
            {venda.items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span>
                  {i.amount}× {i.title}
                </span>
                <span className="tabular-nums">{brl(Number(i.value))}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-current/30 pt-2 text-xl font-black">
            <span>Total</span>
            <span className="tabular-nums">{brl(Number(venda.total))}</span>
          </p>
          <p className="text-sm opacity-90">
            Compra nº {venda.invoiceId}
            {venda.balance !== null && !cancelada && ` · saldo agora: ${brl(Number(venda.balance))}`}
          </p>
        </section>
        {!cancelada && (
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = p.demo ? { ok: true } : await (p.cancelar ?? cancelarCompraCafe)(venda.invoiceId);
                if (r.ok) setCancelada(true);
                else setErro(r.error ?? "Não deu para cancelar.");
              })
            }
            className="text-sm text-gray-600 underline dark:text-gray-400"
          >
            Escolhi errado: cancelar esta compra (até 10 minutos)
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (p.aoTerminar) return p.aoTerminar();
            setVenda(null);
            setCancelada(false);
            setQtd({});
            setChave(novaChave());
            setErro("");
          }}
          className="min-h-12 rounded-2xl border border-gray-300 font-bold dark:border-gray-700"
        >
          {p.aoTerminar ? "Concluir" : "Nova compra"}
        </button>
        {erro && <p role="alert" className="text-center text-sm text-red-700 dark:text-red-400">{erro}</p>}
      </div>
    );

  return (
    <div className="grid gap-3 pb-28">
      <header className="grid gap-1">
        <h1 className="text-2xl font-black text-na-green-dark dark:text-emerald-400">{p.caixa}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {p.saldo !== null && (
            <>
              Seu saldo aqui: <b className="tabular-nums text-gray-900 dark:text-gray-100">{brl(p.saldo)}</b>.{" "}
            </>
          )}
          {p.quiosque ? `${p.nome}, toque no que você pegou.` : "Escolha, pague e pegue o produto."}
        </p>
      </header>
      {!p.produtos.length && <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">Nenhum produto disponível agora.</p>}
      <ul className={p.quiosque ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "grid gap-2"}>
        {p.produtos.map((x) => {
          const n = qtd[x.id] ?? 0;
          const esgotado = x.stock <= 0;
          return (
            <li key={x.id} className={`flex gap-3 rounded-2xl border p-3 ${p.quiosque ? "flex-col" : "items-center"} ${n ? "border-na-green bg-na-green-light/50 dark:border-emerald-700 dark:bg-emerald-950/40" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"}`}>
              {/* Foto do produto pelo nome (lib/cafe-fotos.ts): reconhecer pela imagem é mais rápido que ler. */}
              {fotoDoProduto(x.title) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoDoProduto(x.title)!}
                  alt=""
                  loading="lazy"
                  className={`shrink-0 rounded-xl bg-gray-100 object-cover dark:bg-gray-800 ${p.quiosque ? "aspect-[4/3] w-full" : "size-16"} ${esgotado ? "opacity-40 grayscale" : ""}`}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 dark:text-gray-100">{x.title}</p>
                {x.description && <p className="line-clamp-2 text-xs text-gray-500">{x.description}</p>}
                <p className="text-sm font-semibold tabular-nums text-na-green-dark dark:text-emerald-400">{brl(Number(x.price))}</p>
              </div>
              {esgotado ? (
                <span className="text-xs font-semibold text-gray-500">Esgotado</span>
              ) : (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => mudar(x.id, -1, x.stock)} disabled={!n} aria-label={`Tirar um ${x.title}`} className="grid size-11 place-items-center rounded-full border border-gray-300 disabled:opacity-30 dark:border-gray-700">
                    <Minus size={18} aria-hidden />
                  </button>
                  <span className="w-6 text-center text-lg font-black tabular-nums" aria-live="polite">{n}</span>
                  <button type="button" onClick={() => mudar(x.id, 1, Math.min(x.stock, 50))} aria-label={`Pôr um ${x.title}`} className="grid size-11 place-items-center rounded-full bg-na-green text-white">
                    <Plus size={18} aria-hidden />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}
      <a href="/cafe/fotos/creditos.txt" className="text-center text-[11px] text-gray-400 underline">Créditos das fotos (Wikimedia Commons)</a>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <div className={`mx-auto grid gap-2 ${p.quiosque ? "max-w-3xl" : "max-w-md"}`}>
          {falta && itens.length > 0 && (
            <p className="text-center text-sm text-amber-800 dark:text-amber-300">
              Falta {brl(total - (p.saldo ?? 0))}.{" "}
              {p.quiosque ? "Recarregue pelo Portal, no celular." : <Link href="/portal" className="font-semibold underline">Recarregar o saldo</Link>}
            </p>
          )}
          <button
            type="button"
            disabled={!itens.length || falta || pendente}
            onClick={() =>
              iniciar(async () => {
                setErro("");
                const r = p.demo ? simular() : p.comprar ? await p.comprar(itens, chave) : await comprarNoCafe(p.cashierId, itens, chave);
                if (r.ok) setVenda(r.venda);
                else setErro(r.error);
              })
            }
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-na-green text-lg font-black text-white disabled:opacity-40"
          >
            {pendente ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {itens.length ? `Pagar ${brl(total)} com meu saldo` : "Escolha os produtos"}
          </button>
        </div>
      </div>
    </div>
  );
}
