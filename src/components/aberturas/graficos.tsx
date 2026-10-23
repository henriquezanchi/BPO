import { BarChart3 } from "lucide-react";
import type { Abertura, PainelAberturas } from "./types";
import { despesasDaAbertura, formatarCentavos, formatarReais } from "./utils";

const CARD = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";

export function GraficoCustoConversao({ data }: { data: PainelAberturas }) {
  const relatorios = data.relatorios?.aberturas ?? [];
  const porAbertura = new Map(relatorios.map((relatorio) => [relatorio.aberturaId, relatorio]));
  const linhas = data.aberturas.map((abertura) => ({ abertura, relatorio: porAbertura.get(abertura.id) }));
  const maxCusto = Math.max(1, ...linhas.map(({ relatorio }) => (relatorio?.despesas.realCentavos ?? 0) / 100));

  return (
    <section className={CARD}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-na-gold/15 text-na-gold-dark dark:text-amber-300"><BarChart3 size={18} /></span>
        <div><h2 className="font-black text-gray-950 dark:text-white">Investimento e matrícula</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Custos lançados e conversão observada na base atual do CRM.</p></div>
      </div>
      {linhas.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Crie uma abertura para acompanhar custos e resultados.</p> : <div className="space-y-3">{linhas.map(({ abertura, relatorio }) => {
        const real = relatorio?.despesas.realCentavos ?? 0;
        const conversao = relatorio?.leads.conversaoMatricula;
        const percentual = conversao === null || conversao === undefined ? null : conversao * 100;
        const custoPorMatricula = relatorio?.matriculas.custoRealPorMatriculaCentavos;
        return <article key={abertura.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-950/30"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{abertura.titulo}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{abertura.metaMatriculas} matrículas na meta · {relatorio?.matriculas.confirmadasUnicasMercurio ?? 0} confirmadas no Mercúrio</p></div><div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:min-w-[280px]"><MiniValor label="Orçamento" valor={formatarCentavos(abertura.orcamentoCentavos)} /><MiniValor label="Despesa real" valor={formatarCentavos(real)} /></div></div><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-lg bg-white p-3 dark:bg-gray-900"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Despesa realizada</span><span className="text-xs font-bold text-gray-900 dark:text-gray-100">{formatarCentavos(real)}</span></div><div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800"><div className="h-full rounded-full bg-na-gold" style={{ width: `${Math.min((real / 100 / maxCusto) * 100, 100)}%` }} /></div><p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">Orçamento de {formatarCentavos(abertura.orcamentoCentavos)}</p></div><div className="rounded-lg bg-white p-3 dark:bg-gray-900"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Conversão observada</span><span className="text-xs font-bold text-gray-900 dark:text-gray-100">{percentual === null ? "Sem denominador" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(percentual)}%`}</span></div>{percentual !== null && <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800"><div className="h-full rounded-full bg-na-green" style={{ width: `${Math.max(0, Math.min(percentual, 100))}%` }} /></div>}<p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{relatorio?.leads.matriculadosUnicos ?? 0} matrículas entre {relatorio?.leads.denominadorObservado ?? "—"} interessados vinculados</p></div></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400"><span>Custo por matrícula confirmada: {custoPorMatricula === null || custoPorMatricula === undefined ? "sem amostra suficiente" : formatarCentavos(custoPorMatricula)}</span><span>Base: despesa realizada ÷ matrícula única confirmada no Mercúrio.</span></div>{relatorio?.leads.denominadorObservado === null && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-200">Ainda não há interessados vinculados a esta abertura para calcular conversão.</p>}</article>;
      })}</div>}
      <p className="mt-4 text-[11px] leading-5 text-gray-500 dark:text-gray-400">Conversão e custo por matrícula usam os registros vinculados à abertura, com matrícula acadêmica confirmada pelo Mercúrio. Valores sem denominador ou vínculo confirmado ficam em branco.</p>
    </section>
  );
}

function MiniValor({ label, valor }: { label: string; valor: string }) {
  return <div><p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p><p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-gray-100">{valor}</p></div>;
}

export function LinhasOrcamento({ aberturas, aberturaSelecionadaId }: { aberturas: Abertura[]; aberturaSelecionadaId?: string }) {
  if (aberturas.length === 0) return <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Crie uma abertura para acompanhar orçamento e despesas.</p>;
  return <div className="space-y-3">{aberturas.map((abertura) => {
    const items = despesasDaAbertura(abertura);
    const realizado = items.filter((item) => !item.previsto).reduce((total, item) => total + item.valor, 0);
    const previsto = items.filter((item) => item.previsto).reduce((total, item) => total + item.valor, 0);
    const teto = abertura.orcamentoCentavos / 100;
    const percentual = teto > 0 ? Math.min((realizado / teto) * 100, 100) : 0;
    return <article key={abertura.id} className={`rounded-xl border p-4 ${abertura.id === aberturaSelecionadaId ? "border-na-green/50 bg-na-green-light/40 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-950/30"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{abertura.titulo}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{items.length} despesa(s) registrada(s)</p></div><div className="grid grid-cols-3 gap-3 text-right sm:min-w-[330px]"><ValorMini label="Orçamento" value={formatarReais(teto)} /><ValorMini label="Realizado" value={formatarReais(realizado)} /><ValorMini label="Previsto" value={formatarReais(previsto)} /></div></div>
      <div className="mt-3 h-2 rounded-full bg-gray-200 dark:bg-gray-800"><div className="h-full rounded-full bg-na-gold" style={{ width: `${percentual}%` }} /></div><p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{formatarReais(realizado)} realizados de {formatarReais(teto)} orçados {teto > 0 ? `(${Math.round(percentual)}%)` : "(sem orçamento definido)"}</p>
      {items.length > 0 && <div className="mt-3 divide-y divide-gray-200/80 dark:divide-gray-800">{items.map(({ registro, dados, valor, previsto: ehPrevisto }) => <div key={registro.id} className="flex flex-col gap-1 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold text-gray-800 dark:text-gray-200">{typeof dados.categoria === "string" ? dados.categoria : "Despesa"}<span className="font-normal text-gray-500">{typeof dados.descricao === "string" && dados.descricao ? ` · ${dados.descricao}` : ""}</span></span><span className="flex items-center gap-2 text-gray-600 dark:text-gray-400"><span>{formatarReais(valor)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ehPrevisto ? "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>{ehPrevisto ? "Prevista" : "Realizada"}</span></span></div>)}</div>}
    </article>;
  })}</div>;
}

function ValorMini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p><p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-gray-100">{value}</p></div>;
}
