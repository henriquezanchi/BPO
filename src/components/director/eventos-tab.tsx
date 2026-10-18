"use client";
import {salvarEvento,excluirEvento,definirRecepcaoEvento} from '@/lib/actions/event-actions';
import {EVENT_AUDIENCES} from '@/lib/event-policy';
import type {DirectorDashboard} from '@/lib/director-data';
import {formatBRL} from '@/lib/format';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState,useTransition} from 'react';

const field='w-full min-w-0 rounded-lg border border-gray-300 bg-transparent p-2.5 text-sm dark:border-gray-700';
const button='rounded-lg bg-na-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
type EventView=DirectorDashboard['eventos'][number];
function localDate(date:Date){const d=new Date(date);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function EventosTab({schoolId,data}:{schoolId:string;data:DirectorDashboard}){
 const [editing,setEditing]=useState<EventView|null>(null),[message,setMessage]=useState(''),[pending,start]=useTransition();const router=useRouter();
 function save(form:FormData){start(async()=>{try{
  const result=await salvarEvento(schoolId,{title:String(form.get('title')),description:String(form.get('description')),location:String(form.get('location')),audience:String(form.get('audience')),startsAt:new Date(String(form.get('startsAt'))).toISOString(),endsAt:new Date(String(form.get('endsAt'))).toISOString(),price:Number(form.get('price'))},editing?.id,editing?.revision);
  if(!result.ok){setMessage(result.error??'Não foi possível salvar.');return;}setMessage('Evento salvo na Agenda do público escolhido.');setEditing(null);router.refresh();
 }catch{setMessage('Confira os campos e tente novamente.');}});}
 function mutate(fn:()=>Promise<unknown>,success:string){start(async()=>{try{await fn();setMessage(success);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível concluir.');}});}
 return <div className="space-y-5">
  <p className="text-sm text-gray-500">Crie atividades internas, escolha quem pode participar e organize a recepção. Eventos pagos usam o split da escola; a cobrança só é liberada com a carteira configurada.</p>
  <section className="max-w-xl rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
   <h3 className="mb-4 font-bold">{editing?'Editar evento':'Novo evento interno'}</h3>
   <form key={editing?.id??'new'} action={save} className="space-y-3">
    <label className="flex flex-col gap-1 text-xs">Título<input name="title" required maxLength={160} defaultValue={editing?.title} className={field}/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-1 text-xs">Início<input type="datetime-local" name="startsAt" required defaultValue={editing?localDate(editing.startsAt):''} className={field}/></label><label className="flex min-w-0 flex-col gap-1 text-xs">Término<input type="datetime-local" name="endsAt" required defaultValue={editing?.endsAt?localDate(editing.endsAt):''} className={field}/></label></div>
    <label className="flex flex-col gap-1 text-xs">Local<input name="location" required maxLength={300} defaultValue={editing?.location??''} className={field}/></label>
    <label className="flex flex-col gap-1 text-xs">Quem pode participar?<select name="audience" defaultValue={editing?.audience??'membros'} className={field}>{Object.entries(EVENT_AUDIENCES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="flex flex-col gap-1 text-xs">Contribuição por inscrição (R$; zero para gratuito)<input type="number" name="price" min={0} max={999999.99} step="0.01" required defaultValue={editing?.price??0} className={field}/></label>
    <label className="flex flex-col gap-1 text-xs">Descrição<textarea name="description" rows={3} maxLength={5000} defaultValue={editing?.description??''} className={field}/></label>
    <p className="text-xs text-gray-500">Horários no fuso do seu dispositivo. O valor fica fixo após a primeira inscrição.</p>
    <div className="flex gap-2"><button disabled={pending} className={button}>{pending?'Salvando…':editing?'Salvar alterações':'Publicar evento'}</button>{editing&&<button type="button" onClick={()=>setEditing(null)} className="px-3 text-sm">Cancelar edição</button>}</div>
   </form>
  </section>
  {message&&<p role="status" className="text-sm">{message}</p>}
  <p className="text-xs text-gray-500">Lembretes de inscrição, véspera e horário ficam preparados, aguardando a conexão do WhatsApp. Nenhuma mensagem é declarada enviada sem confirmação do provedor.</p>
  {!data.eventos.length&&<p className="text-sm text-gray-500">Nenhum evento cadastrado ainda.</p>}
  {data.eventos.map(e=><section key={e.id} className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
   <h3 className="font-bold">{e.title} {e.status==='cancelado'&&'· Cancelado'}</h3>
   <p className="text-sm">{new Date(e.startsAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})} (Brasília) · {e.source==='manual'?(e.price?formatBRL(e.price):'Gratuito'):'Inscrição no organizador'}</p>
   <p className="text-xs text-gray-500">{EVENT_AUDIENCES[e.audience as keyof typeof EVENT_AUDIENCES]??'Público restrito'} · {e.inscritos} inscrições · {e.presentes} presenças</p>
   {e.location&&<p className="text-sm">{e.location}</p>}{e.description&&<p className="whitespace-pre-wrap text-sm">{e.description}</p>}
   <div className="flex flex-wrap gap-3 text-sm"><Link className="font-semibold text-na-green dark:text-emerald-400" href={`/eventos/${e.id}/recepcao`}>Abrir lista e recepção</Link>{e.source==='manual'&&e.status==='publicado'&&<><button disabled={pending} onClick={()=>{setEditing(e);window.scrollTo({top:0,behavior:'smooth'});}}>Editar</button><button disabled={pending} className="text-red-700 dark:text-red-300" onClick={()=>{if(confirm('Cancelar este evento? Inscrições e histórico serão preservados. Pagamentos e estornos devem ser conferidos pela Economia.'))mutate(()=>excluirEvento(schoolId,e.id),'Evento cancelado. Confira pagamentos e estornos com a Economia.');}}>Cancelar evento</button></>}</div>
   <details><summary className="cursor-pointer py-2 text-sm font-semibold">Equipe de recepção</summary><p className="mb-2 text-xs text-gray-500">O link exige login e só abre para as pessoas designadas e para a Direção. Não dá acesso ao painel financeiro.</p>
    {e.staff.map(id=><div key={id} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{data.membros.find(m=>m.id===id)?.name??'Voluntário designado'}</span><button disabled={pending} className="text-red-700 dark:text-red-300" onClick={()=>mutate(()=>definirRecepcaoEvento(schoolId,e.id,id,false),'Acesso de recepção removido.')}>Remover</button></div>)}
    <form className="flex flex-wrap gap-2" action={form=>{const id=String(form.get('memberId'));mutate(()=>definirRecepcaoEvento(schoolId,e.id,id,true),'Voluntário designado para a recepção.');}}><select name="memberId" required aria-label={`Voluntário para ${e.title}`} className={field}><option value="">Escolha um voluntário da escola</option>{data.membros.filter(m=>m.mercurioAtivo&&!e.staff.includes(m.id)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><button disabled={pending} className={button}>Liberar recepção</button></form>
   </details>
  </section>)}
 </div>;
}
