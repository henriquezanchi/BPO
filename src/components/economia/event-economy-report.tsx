"use client";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import { useEffect,useRef,useState,useTransition } from "react";
import Link from "next/link";
import { getEventEconomyReport,recordEventMercurioReceipt,reconcileEventRefund } from "@/lib/actions/event-economy-actions";
import { formatBRL } from "@/lib/format";
type Report=Awaited<ReturnType<typeof getEventEconomyReport>>;
const date=(v:string|null)=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'—';
const initialDate=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const field="min-h-11 rounded-lg border border-gray-300 bg-transparent p-2 text-sm dark:border-gray-700";
export function EventEconomyReport({schoolId}:{schoolId:string}){
 const [from,setFrom]=useState(()=>initialDate().slice(0,8)+'01'),[to,setTo]=useState(initialDate),[report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[pending,start]=useTransition();
 const [receipts,setReceipts]=useState<Record<string,string>>({});const generation=useRef(0);
 function load(more=false){const version=++generation.current;start(async()=>{try{setError('');const data=await getEventEconomyReport(schoolId,{from,to,...(more&&report?.nextCursor?{cursor:report.nextCursor}:{})});if(version!==generation.current)return;setReport(previous=>more&&previous?{...data,items:[...previous.items,...data.items]}:data);}catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Não foi possível consultar.');}});}
 function cancelPending(){generation.current++;}
 useEffect(()=>{load();return cancelPending;
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[schoolId]);
 function exportCsv(){if(!report)return;const quote=(v:unknown)=>'"'+String(v??'').replace(/^(\s*[=+@-]|[\t\r])/ ,"'$&").replaceAll('"','""')+'"';
 const headers=['Escola','Evento','Data do evento','Participante','Matrícula','Inscrição','Recebido em','Valor original','Devolvido','Saldo recebido','Situação do pagamento','Asaas','Reembolso','Observação','Recibo Mercúrio','Lançamento informado em','Presença conferida','Conferida em','Declaração do participante'];
 const lines=report.items.map(r=>[report.school,r.event,date(r.eventAt),r.name,r.registrationNo,date(r.registeredAt),date(r.receivedAt),r.amount?.toFixed(2)??'',r.refundedAmount.toFixed(2),r.amount===null?'':((r.receivedAt?r.amount:0)-r.refundedAmount).toFixed(2),r.paymentState,r.paymentId,r.refundLabel,r.refundError,r.receipt,date(r.recordedAt),r.checkedIn?'Sim':'Não confirmada',date(r.checkedInAt),r.selfReportedAttendance]);
 const url=URL.createObjectURL(new Blob(['\uFEFF'+[headers,...lines].map(row=>row.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='eventos-economia.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="space-y-4" aria-label="Relatório de eventos para a Economia"><CollapsibleSection title={<h2 className="text-lg font-bold text-na-green-dark dark:text-na-green-light">Eventos: recebimentos e lançamentos</h2>}>
  <div><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Confira os recebimentos e reembolsos antes de lançar no Mercúrio. Este relatório não faz lançamentos automáticos.</p></div>
  <div className="flex flex-wrap items-end gap-3"><label className="flex flex-col gap-1 text-xs">De<input type="date" value={from} onChange={e=>{generation.current++;setFrom(e.target.value);setReport(null);}} className={field}/></label><label className="flex flex-col gap-1 text-xs">Até<input type="date" value={to} onChange={e=>{generation.current++;setTo(e.target.value);setReport(null);}} className={field}/></label><button disabled={pending} onClick={()=>load()} className="min-h-11 rounded-lg bg-na-green px-4 text-sm font-semibold text-white disabled:opacity-50">{pending?'Consultando…':'Consultar'}</button></div>
  {error&&<p role="alert" className="text-sm text-na-danger-dark dark:text-na-danger-light">{error}</p>}
  {report&&<>
   <p className="text-sm">{report.school} · Caixa cadastrado: {report.cashier??'não definido; confirme no Mercúrio'}.</p>
   <p className="text-sm">Nos registros selecionados: recebido {formatBRL(report.totals.received)} · devolvido {formatBRL(report.totals.refunded)} · saldo {formatBRL(report.totals.received-report.totals.refunded)}.</p>
   <p className="text-xs text-gray-600 dark:text-gray-300">Valores brutos do ingresso, sem estimar taxas ou split. Valores não registrados precisam de conferência e não entram nos totais. O período inclui inscrição sem recebimento, recebimento ou devolução. Confirme a rubrica e a forma de pagamento no Mercúrio; não trate reembolso pendente como devolução concluída.</p>
   <button onClick={exportCsv} disabled={!report.items.length} className={field}>Baixar registros carregados (CSV)</button>
   <p className="text-xs text-gray-600 dark:text-gray-300">{report.items.length} registros carregados{report.nextCursor?' · há mais páginas; carregue-as para incluir no CSV.':'.'}</p>
   {!report.items.length&&<p className="py-5 text-sm">Nenhum registro neste período.</p>}
   {report.items.map(r=><article key={r.id} className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
    <CollapsibleSection title={<h3 className="font-bold">{r.name} · matrícula {r.registrationNo}</h3>}><p>{r.event} · {date(r.eventAt)}{r.eventStatus==='cancelado'?' · Evento cancelado':''}</p>
    <p>Inscrição: {date(r.registeredAt)} · Recebimento: {date(r.receivedAt)}</p><p>Presença: {r.checkedIn?`conferida em ${date(r.checkedInAt)}`:"não confirmada"}{r.selfReportedAttendance?` · Declaração do participante: ${r.selfReportedAttendance} (não substitui a conferência)`:""}</p>
    <p>Ingresso: {r.amount===null?'valor não registrado':formatBRL(r.amount)} · Devolvido: {formatBRL(r.refundedAmount)} · {r.receivedAt?'Recebimento registrado':r.paymentState==='gratuito'?'Gratuito':'Sem recebimento confirmado'}</p>
    {r.paymentId&&<p className="break-all text-xs">Asaas: {r.paymentId}</p>}
    {r.refundState!=='nao_solicitado'&&<p>Reembolso: {r.refundLabel}{r.refundedAt?' · '+date(r.refundedAt):''}</p>}
    {r.refundedAmount>0&&<p className="text-xs text-na-warning-dark dark:text-na-warning-light">Há devolução confirmada: confira também o estorno ou ajuste do lançamento no Mercúrio.</p>}
    {r.refundError&&<p className="text-na-warning-dark dark:text-na-warning-light">{r.refundError}</p>}
    {r.receivedAt&&r.paymentId&&<div className="space-y-2"><p className="text-xs">{r.receipt?`Lançamento informado pela Economia: ${r.receipt} · ${date(r.recordedAt)}`:'Lançamento no Mercúrio ainda não informado.'}</p><label className="flex flex-col gap-1 text-xs">Recibo ou referência no Mercúrio<input maxLength={100} value={receipts[r.id]??r.receipt??''} onChange={e=>setReceipts(v=>({...v,[r.id]:e.target.value}))} className={field}/></label><button disabled={pending} className={field} onClick={()=>start(async()=>{try{await recordEventMercurioReceipt(schoolId,r.id,receipts[r.id]??r.receipt??'');load();}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}})}>Registrar lançamento feito no Mercúrio</button></div>}
    {['erro','revisao','acompanhando'].includes(r.refundState)&&<button disabled={pending} className={field} onClick={()=>start(async()=>{try{await reconcileEventRefund(schoolId,r.id);load();}catch{setError('Não foi possível consultar o reembolso.');}})}>Consultar reembolso no Asaas</button>}
   </CollapsibleSection></article>)}
   {report.nextCursor&&<button disabled={pending} onClick={()=>load(true)} className={field}>Carregar mais registros</button>}
  </>}
  <Link href="/economia" className="inline-block py-3 text-sm font-semibold text-na-green-dark dark:text-na-green-light">Voltar à Economia</Link>
 </CollapsibleSection></section>;
}
