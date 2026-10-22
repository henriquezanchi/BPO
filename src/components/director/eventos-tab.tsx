"use client";
import { PRAZOS_DESISTENCIA } from '@/lib/event-policy';
import {EventPosterInput} from "./event-poster-input";
import {EventReceptionSelector} from "./event-reception-selector";
import {salvarEvento,excluirEvento,definirRecepcaoEvento} from '@/lib/actions/event-actions';
import {ABERTURAS,EVENT_AUDIENCES} from '@/lib/event-policy';
import {AberturaEvento,PublicosEvento} from './publicos-abertura-evento';
import type {DirectorDashboard} from '@/lib/director-data';
import {formatBRL} from '@/lib/format';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState,useTransition} from 'react';
import {AvisoConflitosEvento} from './aviso-conflitos-evento';

const field='w-full min-w-0 rounded-lg border border-gray-300 bg-transparent p-2.5 text-sm dark:border-gray-700';
const button='rounded-lg bg-na-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
type EventView=DirectorDashboard['eventos'][number];
function localDate(date:Date){const d=new Date(date);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function EventosTab({schoolId,data}:{schoolId:string;data:DirectorDashboard}){
 const [cancelling,setCancelling]=useState<EventView|null>(null),[refund,setRefund]=useState(false);
 const [editing,setEditing]=useState<EventView|null>(null),[message,setMessage]=useState(''),[pending,start]=useTransition();const [posterUploading,setPosterUploading]=useState(false),[formGeneration,setFormGeneration]=useState(0);const router=useRouter();
 function save(form:FormData){start(async()=>{try{
  const result=await salvarEvento(schoolId,{title:String(form.get('title')),description:String(form.get('description')),location:String(form.get('location')),publicos:form.getAll('publicos').map(String),abertoA:String(form.get('abertoA')??'filial'),abertoValores:form.getAll('abertoValores').map(String),startsAt:new Date(String(form.get('startsAt'))).toISOString(),endsAt:new Date(String(form.get('endsAt'))).toISOString(),price:Number(form.get('price')),posterPath:String(form.get('posterPath')??'')||null,capacity:form.get('capacity')?Number(form.get('capacity')):null,registrationClosesAt:form.get('registrationClosesAt')?new Date(String(form.get('registrationClosesAt'))).toISOString():null,participantInstructions:String(form.get('participantInstructions')??''),contactInfo:String(form.get('contactInfo')??''),lancheCompartilhado:form.get('lancheCompartilhado')==='on',prazoDesistenciaDias:form.get('prazoDesistencia')==='sem'?null:Number(form.get('prazoDesistencia')??3)},editing?.id,editing?.revision);
  if(!result.ok){setMessage(result.error??'Não foi possível salvar.');return;}setMessage('Evento salvo na Agenda do público escolhido.');setEditing(null);setFormGeneration(n=>n+1);router.refresh();
 }catch{setMessage('Confira os campos e tente novamente.');}});}
 function mutate(fn:()=>Promise<unknown>,success:string){start(async()=>{try{await fn();setMessage(success);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível concluir.');}});}
 return <div className="space-y-5">
  <p className="text-sm text-gray-500">Crie atividades internas, escolha quem pode participar e organize a recepção. Eventos pagos usam o split da escola; a cobrança só é liberada com a carteira configurada.</p>
  {!data.eventPaymentConfigured&&<p role="status" className="rounded-xl border border-amber-300 p-3 text-sm text-amber-800 dark:text-amber-300">O PIX ainda não está liberado: falta configurar a credencial do Asaas no servidor do Portal. Eventos gratuitos continuam disponíveis.</p>}
  <section className="max-w-xl rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
   <h3 className="mb-4 font-bold">{editing?'Editar evento':'Novo evento interno'}</h3>
   <form key={editing?.id??`new-${formGeneration}`} action={save} className="space-y-3">
    <label className="flex flex-col gap-1 text-xs">Título<input name="title" required maxLength={160} defaultValue={editing?.title} className={field}/></label>
    <EventPosterInput initialPath={editing?.posterPath} initialUrl={editing?.posterUrl} onUploading={setPosterUploading}/>
    <div className="grid gap-3 sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-1 text-xs">Início<input type="datetime-local" name="startsAt" required defaultValue={editing?localDate(editing.startsAt):''} className={field}/></label><label className="flex min-w-0 flex-col gap-1 text-xs">Término<input type="datetime-local" name="endsAt" required defaultValue={editing?.endsAt?localDate(editing.endsAt):''} className={field}/></label></div>
    <label className="flex flex-col gap-1 text-xs">Local<input name="location" required maxLength={300} defaultValue={editing?.location??''} className={field}/></label>
    <PublicosEvento inicial={editing?.publicos?.length?editing.publicos:editing?[editing.audience]:undefined}/><AvisoConflitosEvento schoolId={schoolId}/>
    <AberturaEvento inicial={editing?.abertoA} valoresIniciais={editing?.abertoValores}/>
    <label className="flex flex-col gap-1 text-xs">Contribuição por inscrição (R$; zero para gratuito)<input type="number" name="price" min={0} max={999999.99} step="0.01" required defaultValue={editing?.price??0} className={field}/></label>
    {/* Lanche compartilhado (pedido do usuário 2026-10-21): aparece em destaque no evento, como a contribuição. */}
    <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700"><input type="checkbox" name="lancheCompartilhado" defaultChecked={editing?.lancheCompartilhado??false} className="h-4 w-4 accent-na-green"/>Lanche compartilhado <span className="text-xs text-gray-500">(cada participante leva algo para partilhar)</span></label>
    {/* Prazo de desistência com devolução (pedido do usuário 2026-10-22; padrão 3 dias). */}
    <label className="flex flex-col gap-1 text-xs">Desistência com devolução (inscrições pagas)<select name="prazoDesistencia" defaultValue={editing?(editing.prazoDesistenciaDias===null?'sem':String(editing.prazoDesistenciaDias??3)):'3'} className={field}>{PRAZOS_DESISTENCIA.map(p=><option key={String(p.valor)} value={p.valor===null?'sem':String(p.valor)}>{p.rotulo}</option>)}</select></label>
    <label className="flex flex-col gap-1 text-xs">Descrição<textarea name="description" rows={3} maxLength={5000} defaultValue={editing?.description??''} className={field}/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-1 text-xs">Limite de vagas (vazio = sem limite)<input type="number" name="capacity" min={1} max={100000} step={1} defaultValue={editing?.capacity??''} className={field}/></label><label className="flex min-w-0 flex-col gap-1 text-xs">Inscrições até (opcional)<input type="datetime-local" name="registrationClosesAt" defaultValue={editing?.registrationClosesAt?localDate(editing.registrationClosesAt):''} className={field}/></label></div>
    <details><summary className="cursor-pointer py-2 text-sm font-semibold">Orientações e contato</summary><div className="space-y-3 pt-2"><label className="flex flex-col gap-1 text-xs">Orientações ao participante<textarea name="participantInstructions" rows={3} maxLength={5000} defaultValue={editing?.participantInstructions??''} placeholder="O que levar, chegada, acesso ao local…" className={field}/></label><label className="flex flex-col gap-1 text-xs">Contato para dúvidas<input name="contactInfo" maxLength={300} defaultValue={editing?.contactInfo??''} className={field}/></label></div></details>
    <p className="text-xs text-gray-500">Inscrições com pagamento pendente também reservam vaga.</p>
    <p className="text-xs text-gray-500">Horários no fuso do seu dispositivo. O valor fica fixo após a primeira inscrição.</p>
    <div className="flex gap-2"><button disabled={pending||posterUploading} className={button}>{posterUploading?"Enviando cartaz…":pending?'Salvando…':editing?'Salvar alterações':'Publicar evento'}</button>{editing&&<button type="button" onClick={()=>setEditing(null)} className="px-3 text-sm">Cancelar edição</button>}</div>
   </form>
  </section>
  {cancelling&&<section role="dialog" aria-modal="false" aria-labelledby="cancelar-evento-titulo" className="max-w-xl space-y-3 rounded-2xl border border-na-danger/40 p-4">
   <h3 id="cancelar-evento-titulo" className="font-bold">Cancelar {cancelling.title}?</h3>
   <p className="text-sm">As inscrições e o histórico serão preservados.</p>
   <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={refund} onChange={e=>setRefund(e.target.checked)} className="mt-1 h-4 w-4"/>Reembolsar as inscrições</label>
   {refund&&<p className="text-sm text-gray-600 dark:text-gray-300">Os pagamentos serão devolvidos integralmente pelo Asaas. Cobranças ainda não pagas serão canceladas. A devolução depende do saldo disponível e da confirmação do Asaas; pendências ficam no relatório da Economia.</p>}
   {!refund&&<p className="text-sm text-gray-600 dark:text-gray-300">Sem essa opção, o cancelamento não devolve os pagamentos.</p>}
   <div className="flex flex-wrap gap-3"><button disabled={pending} className={button} onClick={()=>mutate(async()=>{await excluirEvento(schoolId,cancelling.id,refund);setCancelling(null);},refund?'Evento cancelado. Reembolsos solicitados; acompanhe as confirmações na Economia.':'Evento cancelado sem reembolso automático.')}>{pending?'Processando…':'Confirmar cancelamento'}</button><button disabled={pending} onClick={()=>setCancelling(null)} className="px-3 text-sm">Voltar</button></div>
  </section>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  <p className="text-xs text-gray-500">Lembretes de inscrição, véspera e horário ficam preparados, aguardando a conexão do WhatsApp. Nenhuma mensagem é declarada enviada sem confirmação do provedor.</p>
  {!data.eventos.length&&<p className="text-sm text-gray-500">Nenhum evento cadastrado ainda.</p>}
  {data.eventos.map(e=><section key={e.id} className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
   {e.posterUrl&&<>
    {/* eslint-disable-next-line @next/next/no-img-element -- cartaz privado com URL assinada */}
    <img src={e.posterUrl} alt={`Cartaz de ${e.title}`} loading="lazy" className="max-h-96 w-full rounded-xl object-contain"/>
   </>}
   <h3 className="font-bold">{e.title} {e.status==='cancelado'&&'· Cancelado'}</h3>
   <p className="text-sm">{new Date(e.startsAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})} · {e.source==='manual'?(e.price?formatBRL(e.price):'Gratuito'):'Inscrição no organizador'}{e.lancheCompartilhado?' · Lanche compartilhado':''}</p>
   <p className="text-xs text-gray-500">{(e.publicos?.length?e.publicos:[e.audience]).map(p=>EVENT_AUDIENCES[p as keyof typeof EVENT_AUDIENCES]??'Público restrito').join(', ')}{e.abertoA&&e.abertoA!=='filial'?` · aberto a ${ABERTURAS[e.abertoA as keyof typeof ABERTURAS]?.toLowerCase()??'outras filiais'}`:''} · {e.inscritos} inscrições{e.capacity!==null&&e.capacity!==undefined?` / ${e.capacity} vagas`:''} · {e.presentes} presenças</p>
   {e.location&&<p className="text-sm">{e.location}</p>}{e.description&&<p className="whitespace-pre-wrap text-sm">{e.description}</p>}
   <div className="flex flex-wrap gap-3 text-sm"><Link className="font-semibold text-na-green dark:text-emerald-400" href={`/eventos/${e.id}/recepcao`}>Abrir lista e recepção</Link>{e.source==='manual'&&e.status==='publicado'&&<><button disabled={pending} onClick={()=>{setEditing(e);window.scrollTo({top:0,behavior:'smooth'});}}>Editar</button><button disabled={pending} className="text-na-danger-dark dark:text-na-danger-light" onClick={()=>{setCancelling(e);setRefund(false);}}>Cancelar evento</button></>}</div>
   <details><summary className="cursor-pointer py-2 text-sm font-semibold">Equipe de recepção</summary><p className="mb-2 text-xs text-gray-500">O link exige login e só abre para as pessoas designadas e para a Direção. Não dá acesso ao painel financeiro.</p>
    {e.staff.map(id=><div key={id} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{data.membros.find(m=>m.id===id)?.name??'Voluntário designado'}</span><button disabled={pending} className="text-red-700 dark:text-red-300" onClick={()=>mutate(()=>definirRecepcaoEvento(schoolId,e.id,id,false),'Acesso de recepção removido.')}>Remover</button></div>)}
    {e.status==='publicado'&&<EventReceptionSelector key={e.staff.join('|')} schoolId={schoolId} eventId={e.id} members={(data.receptionCandidates??data.membros.filter(m=>m.mercurioAtivo)).filter(m=>!e.staff.includes(m.id))}/>}

   </details>
  </section>)}
 </div>;
}
