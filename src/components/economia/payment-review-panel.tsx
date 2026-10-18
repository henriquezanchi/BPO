"use client";

import { getPaymentReview } from "@/lib/actions/payment-review-actions";
import { formatBRL } from "@/lib/format";
import { useEffect, useRef, useState } from "react";

type Page = Awaited<ReturnType<typeof getPaymentReview>>;
export function PaymentReviewPanel({schoolId}:{schoolId:string}) {
  const [status,setStatus]=useState<"pago"|"pendente">("pago");
  const [page,setPage]=useState<Page>({items:[],nextCursor:null});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const version=useRef(0);
  async function load(append=false) {
    const current=++version.current;
    setLoading(true);setError("");
    try {
      const result=await getPaymentReview(schoolId,{status,cursor:append?page.nextCursor??undefined:undefined});
      if(current!==version.current)return;
      setPage(previous=>({items:append?[...previous.items,...result.items]:result.items,nextCursor:result.nextCursor}));
    } catch { if(current===version.current)setError("Não foi possível consultar os pagamentos. Tente novamente."); }
    finally { if(current===version.current)setLoading(false); }
  }
  useEffect(()=>{
    const current=++version.current;
    let cancelled=false;
    getPaymentReview(schoolId,{status}).then(result=>{if(!cancelled && current===version.current)setPage(result);})
      .catch(()=>{if(!cancelled && current===version.current)setError("Não foi possível consultar os pagamentos. Tente novamente.");})
      .finally(()=>{if(!cancelled && current===version.current)setLoading(false);});
    return()=>{cancelled=true;};
  },[schoolId,status]);
  return <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" aria-label="Conferência de pagamentos">
    <h2 className="text-base font-bold text-na-green-dark dark:text-na-green-light">Recebimentos e registro na escola</h2>
    <p className="text-sm text-gray-600 dark:text-gray-300">Receber pelo Portal e registrar no sistema da escola são etapas diferentes. Confira abaixo o andamento, por competência.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm">Mostrar<select aria-label="Situação dos pagamentos" value={status} onChange={e=>{++version.current;setPage({items:[],nextCursor:null});setLoading(true);setError("");setStatus(e.target.value as typeof status);}} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-600"><option value="pago">Recebimento confirmado</option><option value="pendente">Aguardando pagamento</option></select></label>
      <button type="button" disabled={loading} onClick={()=>load()} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm font-semibold disabled:opacity-50">Atualizar</button>
    </div>
    {error && <p role="alert" className="text-sm text-na-danger-dark dark:text-na-danger-light">{error}</p>}
    {loading && <p role="status" className="text-sm">Consultando pagamentos…</p>}
    {!loading && !error && !page.items.length && <p className="text-sm text-gray-600 dark:text-gray-300">Nenhum pagamento nesta situação para a escola.</p>}
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">{page.items.map(item=><li key={item.id} className="space-y-1 py-3 text-sm break-words">
      <div className="flex flex-wrap justify-between gap-2"><strong>{item.name}</strong><span className="tabular-nums">{formatBRL(item.amount)}</span></div>
      <p>Competência {String(item.month).padStart(2,"0")}/{item.year} · {item.method==="PIX"?"Pix":"Cartão"}</p>
      <p className={item.stage.key==="conferir"?"font-semibold text-na-danger-dark dark:text-na-danger-light":"text-na-green-dark dark:text-na-green-light"}>{item.stage.label}</p>
      {item.receivedAt && <p className="text-xs text-gray-600 dark:text-gray-300">Recebido em {new Date(item.receivedAt).toLocaleString("pt-BR")} · {item.attempts} tentativa(s) de lançamento</p>}
    </li>)}</ul>
    {page.nextCursor && <button type="button" disabled={loading} onClick={()=>load(true)} className="min-h-11 w-full rounded-lg bg-na-green px-4 text-sm font-semibold text-white disabled:opacity-50">Carregar mais pagamentos</button>}
    <p className="text-xs text-gray-600 dark:text-gray-300">O valor exibido é o da contribuição; recargas e taxas de cartão ficam fora deste valor. Esta consulta não altera recebimentos nem efetua baixa manual.</p>
  </section>;
}
