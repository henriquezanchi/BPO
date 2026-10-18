"use client";

import {useEffect,useState,useTransition} from "react";
import {createGroupMeetings,getGroupMeetings,changeGroupMeeting} from "@/lib/actions/group-meeting-actions";
import {localInZone,type MeetingInput} from "@/lib/group-meetings";

type Meeting=Awaited<ReturnType<typeof getGroupMeetings>>[number];
export function MeetingManager({groupId}:{groupId:string}) {
 const [rows,setRows]=useState<Meeting[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState<Meeting|null>(null),[scope,setScope]=useState<'esta'|'seguintes'>('esta');
 const [cancelScopes,setCancelScopes]=useState<Record<string,'esta'|'seguintes'>>({});
 const [weekly,setWeekly]=useState(false),[loading,setLoading]=useState(true),[pending,start]=useTransition();
 useEffect(()=>{let active=true;getGroupMeetings(groupId).then(data=>{if(active)setRows(data);}).catch(()=>{if(active)setError('Não foi possível consultar as reuniões. Tente atualizar.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[groupId]);
 async function reload(){setRows(await getGroupMeetings(groupId));}
 function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setError('');setNotice('');
  const input:MeetingInput={title:String(data.get('title')),startsLocal:String(data.get('startsLocal')),endsLocal:String(data.get('endsLocal')),timeZone:String(data.get('timeZone')),repeatUntil:!editing&&weekly?String(data.get('repeatUntil')):undefined,publicDetails:String(data.get('publicDetails')),internalDetails:String(data.get('internalDetails')),fullUniform:data.get('fullUniform')==='on'};
  start(async()=>{try{if(editing){await changeGroupMeeting(editing.id,editing.version,scope,input);setNotice('Reunião atualizada. Alterar o horário exige nova confirmação dos integrantes.');}else{const result=await createGroupMeetings(groupId,input);setNotice(`${result.count} reunião(ões) cadastrada(s) na agenda dos integrantes.`);}setEditing(null);setWeekly(false);if(form.isConnected)form.reset();try{await reload();}catch{setError('Salvo, mas não foi possível atualizar a lista. Use Atualizar reuniões; não é necessário cadastrar novamente.');}}catch(e){setError((e as Error).message);}});
 }
 function cancel(row:Meeting){
  const selected=cancelScopes[row.id]??'esta';
  const reason=prompt('Motivo do cancelamento (visível aos integrantes):');if(!reason)return;
  if(!confirm(selected==='seguintes'?'Cancelar esta e as reuniões seguintes desta série?':'Cancelar somente esta reunião?'))return;
  start(async()=>{try{await changeGroupMeeting(row.id,row.version,selected,null,reason);await reload();setNotice('Cancelamento registrado.');}catch(e){setError((e as Error).message);}});
 }
 const zone=editing?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 return <section className="space-y-4" aria-label="Reuniões da brigada">
  <h2 className="text-base font-bold text-na-green-dark dark:text-na-green-light">Reuniões da brigada</h2>
  <p className="text-sm text-gray-600 dark:text-gray-300">As reuniões são convocações para todos os integrantes com acesso liberado. Quem não puder comparecer pode justificar pela Agenda. Nenhuma mensagem externa é enviada por este cadastro.</p>
  {error&&<p role="alert" className="text-sm text-na-danger-dark dark:text-na-danger-light">{error}</p>}{notice&&<p role="status" className="text-sm text-na-green-dark dark:text-na-green-light">{notice}</p>}
  <form key={editing?.id??'nova'} onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
   <h3 className="font-semibold">{editing?'Editar convocação':'Nova convocação'}</h3>
   <label className="block text-sm">Título<input name="title" defaultValue={editing?.title} required maxLength={120} className="mt-1 min-h-11 w-full rounded-lg border p-2 dark:bg-gray-900"/></label>
   <div className="grid gap-3 sm:grid-cols-2">{(['startsLocal','endsLocal'] as const).map((field,i)=><label key={field} className="min-w-0 text-sm">{i?'Término':'Início'}<input name={field} type="datetime-local" required defaultValue={editing?localInZone(new Date(i?editing.endsAt:editing.startsAt),zone):''} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border p-2 dark:bg-gray-900"/></label>)}</div>
   <label className="block text-sm">Fuso horário<input name="timeZone" required defaultValue={zone} className="mt-1 min-h-11 w-full rounded-lg border p-2 dark:bg-gray-900"/></label>
   {!editing&&<><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={weekly} onChange={e=>setWeekly(e.target.checked)}/> Repetir semanalmente neste horário</label>{weekly&&<label className="block text-sm">Repetir até (máximo de 52 encontros)<input name="repeatUntil" type="date" required className="mt-1 min-h-11 w-full rounded-lg border p-2 dark:bg-gray-900"/></label>}</>}
   {editing?.seriesId&&<label className="block text-sm">Aplicar alteração<select aria-label="Alcance da edição" value={scope} onChange={e=>setScope(e.target.value as typeof scope)} className="mt-1 min-h-11 w-full rounded-lg border p-2 dark:bg-gray-900"><option value="esta">Somente esta reunião</option><option value="seguintes">Esta e as seguintes da série</option></select></label>}
   <label className="flex items-center gap-2 text-sm"><input name="fullUniform" type="checkbox" defaultChecked={editing?.fullUniform}/> Terá CRM com traje completo (sempre visível aos integrantes)</label>
   <label className="block text-sm">Características visíveis aos integrantes<textarea name="publicDetails" maxLength={2000} defaultValue={editing?.publicDetails} placeholder="Aula formativa, oficina, apreciação artística…" className="mt-1 min-h-24 w-full rounded-lg border p-2 dark:bg-gray-900"/></label>
   <label className="block text-sm">Registro interno dos responsáveis<textarea name="internalDetails" maxLength={2000} defaultValue={editing?.internalDetails} className="mt-1 min-h-24 w-full rounded-lg border p-2 dark:bg-gray-900"/></label>
   <div className="flex flex-wrap gap-3"><button disabled={pending} className="min-h-11 rounded-lg bg-na-green px-4 text-sm font-semibold text-white disabled:opacity-50">{pending?'Salvando…':editing?'Salvar alterações':'Cadastrar convocação'}</button>{editing&&<button type="button" onClick={()=>setEditing(null)} className="min-h-11 px-3 text-sm">Sair da edição</button>}</div>
  </form>
  <button type="button" disabled={pending} onClick={()=>start(async()=>{try{await reload();setError('');}catch{setError('Não foi possível atualizar as reuniões.');}})} className="min-h-11 text-sm font-semibold text-na-green-dark dark:text-na-green-light">Atualizar reuniões</button>
  {loading&&<p role="status">Consultando reuniões…</p>}
  {!loading&&!rows.length&&!error&&<p className="text-sm">Nenhuma reunião cadastrada.</p>}
  <ul className="divide-y divide-gray-200 dark:divide-gray-700">{rows.map(row=><li key={row.id} className="space-y-2 py-4 text-sm"><strong>{row.title}</strong><p>{new Date(row.startsAt).toLocaleString('pt-BR',{timeZone:row.timeZone})} — {row.timeZone}</p><p>{row.status==='cancelada'?`Cancelada: ${row.cancellationReason}`:'Convocação obrigatória'}</p>{row.fullUniform&&<p>CRM com traje completo</p>}{row.publicDetails&&<p>{row.publicDetails}</p>}{row.internalDetails&&<details><summary>Registro interno</summary><p>{row.internalDetails}</p></details>}
   <details><summary>Confirmações e justificativas ({row.responses.length})</summary><ul>{row.responses.map(response=><li key={response.memberId} className="mt-2">{response.member.name} · {response.response==='confirmado'?'Confirmou':'Ausência justificada'}{response.justification?` · ${response.justification}`:''}</li>)}</ul><p className="mt-2 text-xs">Quem ainda não respondeu não é marcado como ausente.</p></details>
   {row.status==='agendada'&&new Date(row.startsAt)>new Date()&&<div className="flex flex-wrap items-center gap-4">{row.seriesId&&<select aria-label={`Alcance do cancelamento de ${row.title}`} value={cancelScopes[row.id]??'esta'} onChange={e=>setCancelScopes(previous=>({...previous,[row.id]:e.target.value as 'esta'|'seguintes'}))} className="min-h-11 max-w-full rounded-lg border p-2 dark:bg-gray-900"><option value="esta">Cancelar somente esta</option><option value="seguintes">Cancelar esta e seguintes</option></select>}<button type="button" disabled={pending} onClick={()=>{setEditing(row);setScope('esta');}} className="min-h-11 font-semibold text-na-green-dark dark:text-na-green-light">Editar</button><button type="button" disabled={pending} onClick={()=>cancel(row)} className="min-h-11 text-na-danger-dark dark:text-na-danger-light">Cancelar reunião</button></div>}
  </li>)}</ul>
 </section>;
}
