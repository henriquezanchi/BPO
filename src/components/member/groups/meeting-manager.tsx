"use client";

import {useEffect,useState,useTransition} from "react";
import {createGroupMeetings,getGroupMeetings,changeGroupMeeting} from "@/lib/actions/group-meeting-actions";
import {localInZone,validateMeeting,type MeetingInput} from "@/lib/group-meetings";

type Meeting=Awaited<ReturnType<typeof getGroupMeetings>>[number];
function readableError(error:unknown){const text=error instanceof Error?error.message:'';return /minified react|server components/i.test(text)||!text?'Não foi possível concluir. Atualize a página e tente novamente.':text;}
export function MeetingManager({groupId}:{groupId:string}) {
 const [rows,setRows]=useState<Meeting[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState<Meeting|null>(null),[scope,setScope]=useState<'esta'|'seguintes'>('esta');
 const [cancelScopes,setCancelScopes]=useState<Record<string,'esta'|'seguintes'>>({});
 const [point,setPoint]=useState(false),[loading,setLoading]=useState(true),[pending,start]=useTransition(),[visible,setVisible]=useState(4);
 useEffect(()=>{let active=true;getGroupMeetings(groupId).then(data=>{if(active)setRows(data);}).catch(()=>{if(active)setError('Não foi possível consultar as reuniões. Tente atualizar.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[groupId]);
 async function reload(){setRows(await getGroupMeetings(groupId));}
 function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form);setError('');setNotice('');
  const day=String(data.get('day'));
  const input:MeetingInput={title:String(data.get('title')||'Reunião semanal'),startsLocal:`${day}T${data.get('start')}`,endsLocal:`${day}T${data.get('end')}`,timeZone:editing?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,weekly:!point,publicDetails:String(data.get('publicDetails')),internalDetails:String(data.get('internalDetails')),fullUniform:data.get('fullUniform')==='on'};
  try{validateMeeting(input);}catch(e){setError(readableError(e));return;}
  start(async()=>{try{
   const result=editing?await changeGroupMeeting(editing.id,editing.version,scope,input):await createGroupMeetings(groupId,input);
   if(!result.ok){setError(result.error);return;}
   setNotice(editing?'Reunião atualizada. Mudanças de horário pedem nova confirmação.':point?'Reunião pontual cadastrada na Agenda.':'Rotina semanal salva. Ela se repete no mesmo dia e horário até ser alterada ou encerrada.');
   setEditing(null);setPoint(false);if(form.isConnected)form.reset();
   try{await reload();}catch{setError('Salvo. Use Atualizar reuniões para conferir a lista; não é necessário cadastrar novamente.');}
  }catch(e){setError(readableError(e));}});
 }
 function cancel(row:Meeting){
  const selected=cancelScopes[row.id]??'esta';
  const reason=prompt('Motivo do cancelamento (visível aos integrantes):');if(!reason)return;
  if(!confirm(selected==='seguintes'?'Encerrar a rotina a partir desta reunião, incluindo as próximas semanas?':'Cancelar somente esta reunião?'))return;
  start(async()=>{try{const result=await changeGroupMeeting(row.id,row.version,selected,null,reason);if(!result.ok){setError(result.error);return;}setNotice('Cancelamento registrado.');await reload();}catch(e){setError(readableError(e));}});
 }
 const zone=editing?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 const begin=editing?localInZone(new Date(editing.startsAt),zone):'';
 const end=editing?localInZone(new Date(editing.endsAt),zone):'';
 const inputStyle='mt-1 min-h-11 w-full min-w-0 rounded-lg border border-gray-300 p-2.5 text-base dark:border-gray-600 dark:bg-gray-900';
 return <section className="max-w-lg space-y-4" aria-label="Reuniões do grupo">
  <h2 className="text-base font-bold text-na-green-dark dark:text-na-green-light">Reuniões do grupo</h2>
  <p className="text-sm text-gray-600 dark:text-gray-300">Defina o encontro semanal do grupo. Os integrantes conferem a convocação e justificam ausência pela Agenda.</p>
  {error&&<p role="alert" className="text-sm text-na-danger-dark dark:text-na-danger-light">{error}</p>}{notice&&<p role="status" className="text-sm text-na-green-dark dark:text-na-green-light">{notice}</p>}
  <form key={editing?.id??'nova'} onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
   <h3 className="font-semibold">{editing?'Alterar reunião':point?'Reunião extra':'Encontro semanal'}</h3>
   <label className="block text-sm">{editing?'Data':'A partir de'}<input name="day" type="date" required defaultValue={begin.slice(0,10)} className={inputStyle}/></label>
   <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-sm">Início<input name="start" type="time" required defaultValue={begin.slice(11)} className={inputStyle}/></label><label className="min-w-0 text-sm">Fim<input name="end" type="time" required defaultValue={end.slice(11)} className={inputStyle}/></label></div>
   {!editing&&!point&&<p className="text-xs text-gray-600 dark:text-gray-300">Repete toda semana neste dia e horário, sem data final.</p>}
   {editing?.seriesId&&<label className="block text-sm">Aplicar alteração<select aria-label="Alcance da edição" value={scope} onChange={e=>setScope(e.target.value as typeof scope)} className={inputStyle}><option value="esta">Somente esta reunião</option><option value="seguintes">Esta e todas as seguintes</option></select></label>}
   <label className="flex items-start gap-2 text-sm"><input name="fullUniform" type="checkbox" defaultChecked={editing?.fullUniform} className="mt-1"/> CRM com traje completo (visível a todos)</label>
   <details className="border-t border-gray-200 pt-3 dark:border-gray-700"><summary className="cursor-pointer text-sm font-semibold">Características e outras opções</summary><div className="mt-3 space-y-3">
    {!editing&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={point} onChange={e=>setPoint(e.target.checked)}/> É uma reunião extra, sem repetição</label>}
    <label className="block text-sm">Nome<input name="title" defaultValue={editing?.title??'Reunião semanal'} maxLength={120} className={inputStyle}/></label>
    <label className="block text-sm">Visível aos integrantes<textarea name="publicDetails" maxLength={2000} rows={2} defaultValue={editing?.publicDetails} placeholder="Aula formativa, oficina…" className={inputStyle}/></label>
    <label className="block text-sm">Somente para os responsáveis<textarea name="internalDetails" maxLength={2000} rows={2} defaultValue={editing?.internalDetails} className={inputStyle}/></label>
   </div></details>
   <div className="flex flex-wrap gap-3"><button disabled={pending} className="min-h-11 rounded-lg bg-na-green px-4 text-sm font-semibold text-white disabled:opacity-50">{pending?'Salvando…':editing?'Salvar alterações':point?'Cadastrar reunião extra':'Salvar encontro semanal'}</button>{editing&&<button type="button" onClick={()=>setEditing(null)} className="min-h-11 px-3 text-sm">Sair da edição</button>}</div>
  </form>
  <p className="text-xs text-gray-600 dark:text-gray-300">WhatsApp ainda não está conectado aos integrantes. O cadastro publica na Agenda do Portal.</p>
  <button type="button" disabled={pending} onClick={()=>start(async()=>{try{await reload();setError('');}catch{setError('Não foi possível atualizar as reuniões.');}})} className="min-h-11 text-sm font-semibold text-na-green-dark dark:text-na-green-light">Atualizar reuniões</button>
  {loading&&<p role="status">Consultando reuniões…</p>}{!loading&&!rows.length&&!error&&<p className="text-sm">Nenhuma reunião cadastrada.</p>}
  <ul className="divide-y divide-gray-200 dark:divide-gray-700">{rows.slice(0,visible).map(row=><li key={row.id} className="space-y-2 py-4 text-sm"><strong>{row.title}</strong><p>{new Date(row.startsAt).toLocaleString('pt-BR',{timeZone:row.timeZone,dateStyle:'short',timeStyle:'short'})}</p><p>{row.status==='cancelada'?`Cancelada: ${row.cancellationReason}`:'Convocação obrigatória'}</p>{row.fullUniform&&<p>CRM com traje completo</p>}{row.publicDetails&&<p>{row.publicDetails}</p>}{row.internalDetails&&<details><summary>Registro interno</summary><p>{row.internalDetails}</p></details>}
   <details><summary>Confirmações e justificativas ({row.responses.length})</summary><ul>{row.responses.map(response=><li key={response.memberId} className="mt-2">{response.member.name} · {response.response==='confirmado'?'Confirmou':'Ausência justificada'}{response.justification?` · ${response.justification}`:''}</li>)}</ul><p className="mt-2 text-xs">Quem ainda não respondeu não é marcado como ausente.</p></details>
   {row.status==='agendada'&&new Date(row.startsAt)>new Date()&&<div className="flex flex-wrap items-center gap-4">{row.seriesId&&<select aria-label={`Alcance do cancelamento de ${row.title}`} value={cancelScopes[row.id]??'esta'} onChange={e=>setCancelScopes(previous=>({...previous,[row.id]:e.target.value as 'esta'|'seguintes'}))} className="min-h-11 max-w-full rounded-lg border p-2 dark:bg-gray-900"><option value="esta">Cancelar somente esta</option><option value="seguintes">Encerrar a rotina a partir desta</option></select>}<button type="button" disabled={pending} onClick={()=>{setEditing(row);setScope('esta');}} className="min-h-11 font-semibold text-na-green-dark dark:text-na-green-light">Editar</button><button type="button" disabled={pending} onClick={()=>cancel(row)} className="min-h-11 text-na-danger-dark dark:text-na-danger-light">Cancelar reunião</button></div>}
  </li>)}</ul>
  {rows.length>visible&&<button type="button" className="min-h-11 text-sm font-semibold" onClick={()=>setVisible(n=>n+4)}>Ver próximas reuniões</button>}
 </section>;
}
