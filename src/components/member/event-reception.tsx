"use client";
import {marcarPresencaEvento} from '@/lib/actions/event-actions';
import type {getEventReception} from '@/lib/event-data';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';

export function EventReception({data}:{data:Awaited<ReturnType<typeof getEventReception>>}){
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('todos'),[message,setMessage]=useState(''),[pending,start]=useTransition();const router=useRouter();
 const rows=data.registrations.filter(r=>`${r.member.name} ${r.member.registrationNo??''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))&&(filter==='todos'||(filter==='presentes'?r.checkedIn:filter==='pendentes'?!r.paid:!r.checkedIn)));
 function csv(){
  const cell=(value:unknown)=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const lines=[['Nome','Matrícula','Inscrição','Presença conferida','Comparecimento declarado','Mercúrio'],...rows.map(r=>[r.member.name,r.member.registrationNo,r.paid?(data.price?'Pago':'Gratuito'):r.paymentState==='revisao'?'Cobrança em conferência':'Pagamento pendente',r.checkedIn?'Sim':'Não conferida',r.selfReportedAttendance??'Sem resposta',r.mercurioStatus])];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(line=>line.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='recepcao-evento.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="space-y-4">
  <p className="text-sm">{data.registrations.length} inscritos · {data.registrations.filter(r=>r.checkedIn).length} presenças conferidas</p>
  <div className="flex flex-wrap gap-2"><input aria-label="Buscar inscrito" placeholder="Nome ou matrícula" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent p-3 text-sm dark:border-gray-700"/><select aria-label="Filtrar inscrições" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border bg-transparent p-3 text-sm"><option value="todos">Todos</option><option value="presentes">Presentes</option><option value="ausentes">Presença não conferida</option><option value="pendentes">Pagamento pendente</option></select></div>
  <button onClick={csv} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">Baixar lista filtrada (CSV)</button>
  <p className="text-xs text-gray-500">Uma resposta do aluno não substitui a conferência da recepção. O registro no Mercúrio aguarda integração com os responsáveis.</p>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {!rows.length&&<p className="text-sm">Nenhuma inscrição neste filtro.</p>}
  <ul className="space-y-2">{rows.map(r=><li key={r.id} className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700"><p className="font-semibold">{r.member.name}</p><p className="text-xs text-gray-500">Matrícula {r.member.registrationNo??'não informada'} · {r.paid?(data.price?'Pago':'Gratuito'):r.paymentState==='revisao'?'Cobrança em conferência':'Pagamento pendente'}</p><p className="text-sm">{r.checkedIn?'Presença conferida':'Presença não conferida'}{r.selfReportedAttendance&&` · Aluno declarou: ${r.selfReportedAttendance==='sim'?'compareceu':'não compareceu'}`}</p><button disabled={pending||data.status!=='publicado'||(!r.paid&&!r.checkedIn)} onClick={()=>start(async()=>{try{await marcarPresencaEvento('',r.id,!r.checkedIn);setMessage('Conferência salva no histórico do aluno.');router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar.');}})} className="rounded-lg bg-na-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{r.checkedIn?'Corrigir presença':'Confirmar presença'}</button></li>)}</ul>
 </div>;
}
