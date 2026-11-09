import { ArrowLeft, Coffee } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedMember } from "@/lib/auth";
import { fortunaConsumo, fortunaExtrato, fortunaGetBranches, type FortunaRecebimento, type FortunaVenda } from "@/lib/fortuna/client";

export const dynamic = "force-dynamic";

const reais = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PERIODOS = [30, 90, 180] as const;
const METODO: Record<string, string> = { PIX: "Pix", Dinheiro: "Dinheiro", Debito: "Débito", Credito: "Crédito", Transferencia: "Transferência", Estorno: "Estorno" };

/** Até 4 páginas de 50 (200 lançamentos): o suficiente para o período escolhido, sem estourar o limite da API. */
async function todas<T>(buscar: (pagina: number) => Promise<{ data: T[]; hasMore: boolean }>) {
  const lista: T[] = [];
  for (let p = 1; p <= 4; p++) {
    const r = await buscar(p);
    lista.push(...r.data);
    if (!r.hasMore) break;
  }
  return lista;
}

/**
 * Extrato do Café (pedido do usuário 09/11/2026): o que a pessoa consumiu e os créditos que entraram na carteira do
 * Fortuna, pela API de integração. Só a própria pessoa.
 */
export default async function ExtratoFortunaPage(props: { searchParams: Promise<{ dias?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/portal/fortuna");
  const pedido = (await props.searchParams).dias;
  const dias = PERIODOS.find((d) => String(d) === pedido) ?? 30;
  const fim = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const inicio = new Date(Date.now() - dias * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  let consumo: FortunaVenda[] = [];
  let recebimentos: FortunaRecebimento[] = [];
  let filiais = new Map<number, string>();
  let erro: string | null = null;
  if (member.fortunaClientId) {
    try {
      const id = member.fortunaClientId;
      [consumo, recebimentos, filiais] = await Promise.all([
        todas((p) => fortunaConsumo(id, inicio, fim, p)),
        todas((p) => fortunaExtrato(id, inicio, fim, p)),
        fortunaGetBranches().then((b) => new Map(b.map((x) => [x.id, x.title]))).catch(() => new Map<number, string>()),
      ]);
    } catch (e) {
      console.error("Extrato do Fortuna:", (e as Error).message);
      erro = "O Fortuna não respondeu agora. Tente de novo em instantes.";
    }
  }
  const gasto = consumo.reduce((s, v) => s + Number(v.value) - Number(v.discount || 0), 0);
  const entrou = recebimentos.reduce((s, r) => s + Number(r.amount), 0);
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Portal do Aluno
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-xl font-black text-na-green-dark dark:text-emerald-400">
          <Coffee size={22} /> Extrato do Café
        </h1>
        <nav className="flex gap-1.5" aria-label="Período">
          {PERIODOS.map((d) => (
            <Link
              key={d}
              href={`/portal/fortuna?dias=${d}`}
              aria-current={d === dias ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${d === dias ? "bg-na-green-dark text-white" : "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}
            >
              {d} dias
            </Link>
          ))}
        </nav>
      </header>

      {!member.fortunaClientId ? (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          Sua conta ainda não está ligada ao Fortuna. Fale com a secretaria.
        </p>
      ) : erro ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{erro}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-[11px] text-gray-500">Consumo no período</p>
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{reais(gasto)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-[11px] text-gray-500">Créditos no período</p>
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{reais(entrou)}</p>
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Consumo</h2>
            {consumo.length ? (
              <ul className="flex flex-col gap-1.5">
                {consumo.map((v) => (
                  <li key={v.id} className="rounded-xl border border-gray-200 bg-white p-3 text-[13px] dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-gray-500">
                        {quando(v.saleDate)} · {v.cashier ? (filiais.get(v.cashier.branchId) ?? v.cashier.title) : "Café"}
                        {v.dependent ? ` · ${v.dependent}` : ""}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{reais(Number(v.value) - Number(v.discount || 0))}</span>
                    </div>
                    <p className="mt-0.5 text-gray-700 dark:text-gray-300">{v.products.map((p) => `${p.amount > 1 ? `${p.amount}× ` : ""}${p.product.title}`).join(", ")}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-gray-600 dark:text-gray-400">Nenhum consumo no período.</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Créditos</h2>
            {recebimentos.length ? (
              <ul className="flex flex-col gap-1.5">
                {recebimentos.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 text-[13px] dark:border-gray-800 dark:bg-gray-900">
                    <span className="text-gray-600 dark:text-gray-400">
                      {quando(r.createdAt)} · {METODO[r.method] ?? r.method} · {filiais.get(r.branchId) ?? `Filial ${r.branchId}`}
                    </span>
                    <span className={`font-semibold tabular-nums ${Number(r.amount) < 0 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>{reais(r.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-gray-600 dark:text-gray-400">Nenhum crédito no período.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
