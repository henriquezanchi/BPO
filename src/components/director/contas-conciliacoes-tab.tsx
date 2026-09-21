"use client";

import { excluirAccountantDocument, getAccountantDocumentUrl, uploadAccountantDocument } from "@/lib/actions/accountant-actions";
import { confirmarPrevisao, importarExtratoOfx, removerPrevisao } from "@/lib/actions/bank-import-actions";
import { criarContaAPagar, desmarcarContaComoPaga, editarContaAPagar, excluirContaAPagar, marcarContaComoPaga } from "@/lib/actions/repasse-actions";
import { atribuirRubrica, sincronizarRubricasDePagamento } from "@/lib/actions/rubrica-actions";
import type { DirectorDashboard } from "@/lib/director-data";
import { formatBRL, formatDateBR } from "@/lib/format";
import { RECURRENCE_FREQUENCY_LABEL } from "@/lib/recurrence-labels";
import type { RecurrenceFrequency } from "@prisma/client";
import { ChevronDown, Loader2, Paperclip, Pencil, FileText, RefreshCw, Repeat, Sparkles, Tag, Trash2, Upload, X } from "lucide-react";
import { useState, useTransition } from "react";
import { EmptyState } from "./diretor-dashboard";

type PayableRow = DirectorDashboard["despesasPendentes"][number] | DirectorDashboard["despesasRealizadas"][number];

const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Agrupa as contas pagas por mês (ano-mês de paidAt), mantendo a ordem já vinda (desc por paidAt). */
function agruparPorMes(contas: DirectorDashboard["despesasRealizadas"]) {
  const grupos = new Map<string, { ano: number; mes: number; itens: DirectorDashboard["despesasRealizadas"] }>();
  for (const c of contas) {
    const ano = c.paidAt.getFullYear();
    const mes = c.paidAt.getMonth();
    const chave = `${ano}-${mes}`;
    if (!grupos.has(chave)) grupos.set(chave, { ano, mes, itens: [] });
    grupos.get(chave)!.itens.push(c);
  }
  return [...grupos.values()];
}

function DocumentosDaConta({ schoolId, payable }: { schoolId: string; payable: PayableRow }) {
  const [isPending, startTransition] = useTransition();

  function handleUpload(formData: FormData) {
    startTransition(() => uploadAccountantDocument(schoolId, payable.id, formData));
  }

  async function handleAbrir(documentId: string) {
    const url = await getAccountantDocumentUrl(schoolId, documentId);
    window.open(url, "_blank");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {payable.documents.map((d) => (
        <span key={d.id} className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <button onClick={() => handleAbrir(d.id)} className="inline-flex items-center gap-1 hover:underline">
            <FileText size={10} /> {d.title}
          </button>
          <button onClick={() => startTransition(() => excluirAccountantDocument(schoolId, d.id))} disabled={isPending} className="text-gray-400 hover:text-red-600">
            <Trash2 size={10} />
          </button>
        </span>
      ))}
      {payable.documents.length === 0 && (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">Comprovante pendente</span>
      )}
      <form action={handleUpload} className="inline-flex items-center gap-1">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 hover:border-na-green hover:text-na-green-dark dark:border-gray-700 dark:text-gray-400">
          {isPending ? <Loader2 size={10} className="animate-spin" /> : <Paperclip size={10} />}
          Anexar
          <input type="file" name="file" className="hidden" onChange={(e) => e.target.form?.requestSubmit()} />
        </label>
      </form>
    </div>
  );
}

function MedidorConciliacao({ percentual }: { percentual: number }) {
  const cor = percentual >= 80 ? "emerald" : percentual >= 50 ? "amber" : "red";
  const classes: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  };
  const barra: Record<string, string> = { emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
  return (
    <div className={`rounded-2xl border p-5 ${classes[cor]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold opacity-80">Contas Conciliadas (com recibo/NF anexado)</p>
        <p className="text-2xl font-bold">{percentual.toFixed(0)}%</p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className={`h-full rounded-full ${barra[cor]}`} style={{ width: `${Math.min(100, percentual)}%` }} />
      </div>
    </div>
  );
}

function RubricaSelect({ schoolId, payable, rubricasDisponiveis }: { schoolId: string; payable: PayableRow; rubricasDisponiveis: DirectorDashboard["rubricasDisponiveis"] }) {
  const [isPending, startTransition] = useTransition();

  if (rubricasDisponiveis.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1">
      <Tag size={10} className="text-gray-400" />
      <select
        value={payable.rubricaId ?? ""}
        onChange={(e) => startTransition(() => atribuirRubrica(schoolId, payable.id, e.target.value || null))}
        disabled={isPending}
        className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
          Sem rubrica
        </option>
        {rubricasDisponiveis.map((r) => (
          <option key={r.id} value={r.id} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ContaRow({
  schoolId,
  payable,
  tipo,
  rubricasDisponiveis,
}: {
  schoolId: string;
  payable: PayableRow;
  tipo: "pendente" | "realizada";
  rubricasDisponiveis: DirectorDashboard["rubricasDisponiveis"];
}) {
  const [isPending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);

  function handleSalvarEdicao(formData: FormData) {
    const vendor = String(formData.get("vendor") ?? "");
    const amount = Number(formData.get("amount"));
    const dueDate = String(formData.get("dueDate") ?? "");
    if (!vendor || !amount || !dueDate) return;
    startTransition(async () => {
      await editarContaAPagar(schoolId, payable.id, vendor, amount, dueDate);
      setEditando(false);
    });
  }

  if (editando) {
    return (
      <li className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
        <form action={handleSalvarEdicao} className="flex flex-wrap items-center gap-2">
          <input
            name="vendor"
            defaultValue={payable.vendor}
            required
            className="min-w-[140px] flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <input
            name="amount"
            type="number"
            step="0.01"
            defaultValue={payable.amount}
            required
            className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <input
            name="dueDate"
            type="date"
            defaultValue={payable.dueDate.toISOString().slice(0, 10)}
            required
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button type="submit" disabled={isPending} className="rounded-lg bg-na-green px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60">
            Salvar
          </button>
          <button type="button" onClick={() => setEditando(false)} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] text-gray-600 dark:border-gray-700 dark:text-gray-300">
            <X size={12} />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-gray-900 dark:text-gray-100">{payable.vendor}</span>
          {payable.predicted && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
              <Sparkles size={10} /> Previsão automática
            </span>
          )}
          {payable.recurring && !payable.predicted && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
              <Repeat size={10} /> Recorrente{payable.recurrenceFrequency ? ` · ${RECURRENCE_FREQUENCY_LABEL[payable.recurrenceFrequency]}` : ""}
            </span>
          )}
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {tipo === "realizada" ? `Pago em ${formatDateBR((payable as DirectorDashboard["despesasRealizadas"][number]).paidAt)}` : `Vence em ${formatDateBR(payable.dueDate)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBRL(payable.amount)}</span>

          {tipo === "pendente" && payable.predicted && (
            <button
              onClick={() => startTransition(() => confirmarPrevisao(schoolId, payable.id))}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Confirmar
            </button>
          )}
          {tipo === "pendente" && !payable.predicted && (
            <button
              onClick={() => startTransition(() => marcarContaComoPaga(schoolId, payable.id))}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Marcar pago
            </button>
          )}
          {tipo === "realizada" && (
            <button
              onClick={() => startTransition(() => desmarcarContaComoPaga(schoolId, payable.id))}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Desfazer
            </button>
          )}
          <button onClick={() => setEditando(true)} className="text-gray-400 hover:text-na-green-dark">
            <Pencil size={14} />
          </button>
          <button
            onClick={() => {
              if (payable.predicted) startTransition(() => removerPrevisao(schoolId, payable.id));
              else if (confirm(`Excluir "${payable.vendor}"? Isso também remove os documentos anexados.`)) startTransition(() => excluirContaAPagar(schoolId, payable.id));
            }}
            disabled={isPending}
            className="text-gray-400 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DocumentosDaConta schoolId={schoolId} payable={payable} />
        <RubricaSelect schoolId={schoolId} payable={payable} rubricasDisponiveis={rubricasDisponiveis} />
      </div>
    </li>
  );
}

export function ContasConciliacoesTab({ schoolId, data }: { schoolId: string; data: DirectorDashboard }) {
  const [isPending, startTransition] = useTransition();
  const [resultadoImportacao, setResultadoImportacao] = useState<string | null>(null);
  const [resultadoRubricas, setResultadoRubricas] = useState<string | null>(null);
  const [recorrente, setRecorrente] = useState(false);

  function handleCriarConta(formData: FormData) {
    const vendor = String(formData.get("vendor") ?? "");
    const amount = Number(formData.get("amount"));
    const dueDate = String(formData.get("dueDate") ?? "");
    const recurring = formData.get("recurring") === "on";
    const frequency = (formData.get("frequency") as RecurrenceFrequency) || "mensal";
    if (!vendor || !amount || !dueDate) return;
    startTransition(() => criarContaAPagar(schoolId, vendor, amount, dueDate, recurring, recurring ? frequency : null));
  }

  function handleImportarOfx(formData: FormData) {
    startTransition(async () => {
      setResultadoImportacao(null);
      const { importadas, duplicadas, previstas } = await importarExtratoOfx(schoolId, formData);
      setResultadoImportacao(
        `${importadas} conta(s) importada(s), ${duplicadas} já existente(s) (ignorada), ${previstas} conta(s) prevista(s) pro mês seguinte por recorrência.`,
      );
    });
  }

  function handleSincronizarRubricas() {
    startTransition(async () => {
      setResultadoRubricas(null);
      try {
        await sincronizarRubricasDePagamento(schoolId);
        setResultadoRubricas("Solicitação enviada — pode levar alguns minutos até a lista de rubricas abaixo refletir o Mercúrio (recarregue a página depois).");
      } catch (e) {
        setResultadoRubricas((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <MedidorConciliacao percentual={data.kpis.percentualConciliado} />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-bold text-na-green-dark dark:text-emerald-400">Importar Extrato Bancário (OFX)</h3>
        <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">
          Lê os débitos do extrato e lança como contas já pagas (o extrato representa o passado). Reimportar o mesmo período não duplica nada.
        </p>
        <form action={handleImportarOfx} className="flex flex-wrap items-center gap-2">
          <input name="file" type="file" accept=".ofx,.qfx" required className="text-[11px] text-gray-700 dark:text-gray-300" />
          <button type="submit" disabled={isPending} className="inline-flex items-center gap-1 rounded-lg bg-na-green px-3 py-2 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-60">
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Importar
          </button>
        </form>
        {resultadoImportacao && <p className="mt-3 text-[11px] font-medium text-na-green-dark dark:text-emerald-400">{resultadoImportacao}</p>}

        <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          <button
            onClick={handleSincronizarRubricas}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sincronizar Rubricas do Mercúrio
          </button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">({data.rubricasDisponiveis.length} rubrica(s) conhecida(s))</span>
        </div>
        {resultadoRubricas && <p className="mt-2 text-[11px] font-medium text-na-green-dark dark:text-emerald-400">{resultadoRubricas}</p>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-bold text-na-green-dark dark:text-emerald-400">Contas a Pagar — Previstas</h3>
        <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">Anexe o recibo/NF direto na conta correspondente — evita conciliar o documento errado com o pagamento errado.</p>
        {data.despesasPendentes.length === 0 ? (
          <EmptyState text="Nenhuma conta a pagar cadastrada." />
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {data.despesasPendentes.map((p) => (
              <ContaRow key={p.id} schoolId={schoolId} payable={p} tipo="pendente" rubricasDisponiveis={data.rubricasDisponiveis} />
            ))}
          </ul>
        )}
        <form action={handleCriarConta} className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          <input name="vendor" placeholder="Fornecedor" required className="min-w-[140px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input name="amount" type="number" step="0.01" placeholder="Valor" required className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input name="dueDate" type="date" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <label className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-300">
            <input name="recurring" type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} /> Recorrente
          </label>
          {recorrente && (
            <select name="frequency" defaultValue="mensal" className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
              {Object.entries(RECURRENCE_FREQUENCY_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                  {label}
                </option>
              ))}
            </select>
          )}
          <button type="submit" disabled={isPending} className="rounded-lg bg-na-green px-3 py-2 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-60">
            + Conta
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-bold text-na-green-dark dark:text-emerald-400">Contas Pagas — Realizadas</h3>
        {data.despesasRealizadas.length === 0 ? (
          <EmptyState text="Nenhuma conta paga registrada ainda." />
        ) : (
          <div className="flex flex-col gap-2">
            {agruparPorMes(data.despesasRealizadas).map((grupo) => {
              const agora = new Date();
              const ehMesAtual = grupo.ano === agora.getFullYear() && grupo.mes === agora.getMonth();
              const totalGrupo = grupo.itens.reduce((soma, i) => soma + i.amount, 0);
              return (
                <details key={`${grupo.ano}-${grupo.mes}`} open={ehMesAtual} className="group rounded-lg border border-gray-100 dark:border-gray-800">
                  <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm">
                    <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                      <ChevronDown size={14} className="text-gray-400 transition-transform group-open:rotate-180" />
                      {NOMES_MES[grupo.mes]}/{grupo.ano}
                      <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">({grupo.itens.length})</span>
                    </span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{formatBRL(totalGrupo)}</span>
                  </summary>
                  <ul className="flex flex-col gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
                    {grupo.itens.map((p) => (
                      <ContaRow key={p.id} schoolId={schoolId} payable={p} tipo="realizada" rubricasDisponiveis={data.rubricasDisponiveis} />
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
