"use client";
import {marcarPresencaEvento,marcarPresencaUlisses} from '@/lib/actions/event-actions';
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
 // Evento do Ulisses (27/10/2026): a lista vem do Ulisses; inscrições pelo Portal só aparecem se existirem.
 if(data.source==='ulisses'&&!data.registrations.length)return <RecepcaoUlisses data={data}/>;
 return <div className="space-y-4">
  {data.source==='ulisses'&&<RecepcaoUlisses data={data}/>}
  <p className="text-sm">{data.registrations.length} inscritos · {data.registrations.filter(r=>r.checkedIn).length} presenças conferidas</p>
  <div className="flex flex-wrap gap-2"><input aria-label="Buscar inscrito" placeholder="Nome ou matrícula" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent p-3 text-sm dark:border-gray-700"/><select aria-label="Filtrar inscrições" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border bg-transparent p-3 text-sm"><option value="todos">Todos</option><option value="presentes">Presentes</option><option value="ausentes">Presença não conferida</option><option value="pendentes">Pagamento pendente</option></select></div>
  <button onClick={csv} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">Baixar lista filtrada (CSV)</button>
  <p className="text-xs text-gray-500">Uma resposta do aluno não substitui a conferência da recepção. O registro no Mercúrio aguarda integração com os responsáveis.</p>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {!rows.length&&<p className="text-sm">Nenhuma inscrição neste filtro.</p>}
  {rows.length>0&&<div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
   {/* Lista compacta (26/10/2026): presença numa caixinha à direita, em vez de um botão por pessoa. */}
   <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><span>Inscrito</span><span>Presente</span></div>
   <ul className="divide-y divide-gray-100 dark:divide-gray-800">{rows.map(r=>{
    const bloqueada=pending||data.status!=='publicado'||(!r.paid&&!r.checkedIn);
    return <li key={r.id}><label className={`flex items-center gap-3 px-3 py-2.5 ${bloqueada?'':'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
     <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold">{r.member.name}</span>
      <span className="block text-xs text-gray-500">{r.member.registrationNo??'sem matrícula'} · {r.paid?(data.price?'Pago':'Gratuito'):r.paymentState==='revisao'?'Cobrança em conferência':'Pagamento pendente'}{r.selfReportedAttendance&&` · declarou que ${r.selfReportedAttendance==='sim'?'veio':'não veio'}`}</span>
     </span>
     <input type="checkbox" aria-label={`Presença de ${r.member.name}`} checked={r.checkedIn} disabled={bloqueada} onChange={()=>start(async()=>{try{await marcarPresencaEvento('',r.id,!r.checkedIn);setMessage(r.checkedIn?`Presença de ${r.member.name} desmarcada.`:`Presença de ${r.member.name} conferida.`);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar.');}})} className="size-5 shrink-0 accent-na-green disabled:opacity-40"/>
    </label></li>;
   })}</ul>
  </div>}
 </div>;
}

/** Inscritos do Ulisses: nome, se é aluno da escola e a presença, que é marcada no próprio Ulisses. */
function RecepcaoUlisses({data}:{data:Awaited<ReturnType<typeof getEventReception>>}){
 const [lista,setLista]=useState(data.ulisses??[]),[search,setSearch]=useState(''),[filter,setFilter]=useState('todos'),[message,setMessage]=useState(''),[pending,start]=useTransition();
 if(!data.ulisses)return <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">{data.ulissesErro??'Inscritos do Ulisses indisponíveis.'}</p>;
 const rows=lista.filter(i=>`${i.nome} ${i.aluno?.matricula??''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))&&(filter==='todos'||(filter==='presentes'?i.compareceu:filter==='alunos'?!!i.aluno:!i.compareceu)));
 const alunos=lista.filter(i=>i.aluno).length;
 return <div className="space-y-4">
  <p className="text-sm">{lista.length} {lista.length===1?'inscrito':'inscritos'} no Ulisses{alunos?` (${alunos} ${alunos===1?'aluno':'alunos'} da escola)`:''} · {lista.filter(i=>i.compareceu).length} presenças</p>
  <div className="flex flex-wrap gap-2"><input aria-label="Buscar inscrito" placeholder="Nome ou matrícula" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent p-3 text-sm dark:border-gray-700"/><select aria-label="Filtrar inscrições" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border bg-transparent p-3 text-sm"><option value="todos">Todos</option><option value="presentes">Presentes</option><option value="ausentes">Presença não marcada</option><option value="alunos">Alunos da escola</option></select></div>
  <p className="text-xs text-gray-500">A inscrição deste evento é feita no Ulisses. A presença marcada aqui é gravada no Ulisses.</p>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {!rows.length&&<p className="text-sm">{lista.length?'Nenhuma inscrição neste filtro.':'Ninguém inscrito no Ulisses ainda.'}</p>}
  {rows.length>0&&<div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
   <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><span>Inscrito no Ulisses</span><span>Presente</span></div>
   <ul className="divide-y divide-gray-100 dark:divide-gray-800">{rows.map(i=>{
    const bloqueada=pending||data.status!=='publicado';
    return <li key={i.id}><label className={`flex items-center gap-3 px-3 py-2.5 ${bloqueada?'':'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
     <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold">{i.nome}</span>
      <span className="block text-xs text-gray-500">{i.aluno?`Aluno da escola${i.aluno.matricula?` · matrícula ${i.aluno.matricula}`:''}`:'Público externo'}</span>
     </span>
     <input type="checkbox" aria-label={`Presença de ${i.nome}`} checked={i.compareceu} disabled={bloqueada} onChange={()=>start(async()=>{const r=await marcarPresencaUlisses(data.id,i.id,!i.compareceu);if(!r.ok){setMessage(r.error);return;}setLista(l=>l.map(x=>x.id===i.id?{...x,compareceu:!i.compareceu}:x));setMessage(i.compareceu?`Presença de ${i.nome} desmarcada no Ulisses.`:`Presença de ${i.nome} marcada no Ulisses.`);})} className="size-5 shrink-0 accent-na-green disabled:opacity-40"/>
    </label></li>;
   })}</ul>
  </div>}
 </div>;
}
