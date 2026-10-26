"use client";
import {definirRecepcaoEmLote} from '@/lib/actions/event-actions';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';

type SemAcesso={id:string;nome:string;podeLiberar:boolean};
const lista=(nomes:string[])=>nomes.length<=1?nomes.join(''):`${nomes.slice(0,-1).join(', ')} e ${nomes.at(-1)}`;

/**
 * Equipe de recepção do evento. Inclui quem já tem acesso de voluntário; para quem não tem (26/10/2026), pergunta se
 * quer liberar o acesso, quando a pessoa pode liberar; senão, explica a quem pedir.
 */
export function EventReceptionSelector({schoolId,eventId,members}:{schoolId:string;eventId:string;members:{id:string;name:string;comAcesso?:boolean}[]}){
 const [search,setSearch]=useState(''),[selected,setSelected]=useState<Set<string>>(new Set()),[message,setMessage]=useState(''),[pending,start]=useTransition();const router=useRouter();
 const [liberaveis,setLiberaveis]=useState<SemAcesso[]>([]);
 const filtered=members.filter(m=>m.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));

 function enviar(ids:string[],liberarAcessoDe:string[]=[]){
  setMessage('');
  start(async()=>{
   try{
    const r=await definirRecepcaoEmLote(schoolId,eventId,ids,liberarAcessoDe);
    if(!r.ok){setMessage(r.error);return;}
    const partes:string[]=[];
    if(r.incluidos.length)partes.push(r.incluidos.length===1?`${r.incluidos[0]} foi incluído(a) na recepção.`:`${r.incluidos.length} pessoas incluídas na recepção.`);
    const naoPode=r.semAcesso.filter(p=>!p.podeLiberar);
    if(naoPode.length)partes.push(`${lista(naoPode.map(p=>p.nome))} não ${naoPode.length===1?'tem':'têm'} acesso de voluntário e não ${naoPode.length===1?'foi incluído(a)':'foram incluídos'}. Peça a liberação a um responsável (Direção da filial ou responsável pelo grupo da pessoa), em "Liberar acessos" no Portal.`);
    if(r.inativos)partes.push(`${r.inativos} pessoa(s) não estão ativas nesta filial e ficaram de fora.`);
    setMessage(partes.join(' '));
    setLiberaveis(r.semAcesso.filter(p=>p.podeLiberar));
    setSelected(new Set());
    router.refresh();
   }catch{setMessage('Não foi possível concluir. Tente novamente.');}
  });
 }

 return <div className="space-y-3">
  <p className="text-xs text-gray-500">Marque quem vai trabalhar na recepção. Quem ainda não tem acesso de voluntário fica para você decidir no fim.</p>
  <input aria-label="Buscar pessoas para a recepção" placeholder="Buscar por nome" value={search} onChange={e=>setSearch(e.target.value)} className="w-full min-w-0 rounded-lg border bg-transparent p-2.5 text-sm"/>
  <button type="button" disabled={pending} className="py-2 text-xs font-semibold" onClick={()=>setSelected(old=>new Set([...old,...filtered.map(m=>m.id)].slice(0,200)))}>Selecionar exibidos</button>
  <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
   {!filtered.length&&<p className="p-2 text-xs">Nenhuma pessoa disponível neste filtro.</p>}
   {filtered.map(m=><label key={m.id} className="flex items-center gap-3 rounded-lg p-2 text-sm"><input type="checkbox" name="receptionMember" value={m.id} checked={selected.has(m.id)} disabled={pending} onChange={e=>setSelected(old=>{const next=new Set(old);if(e.target.checked)next.add(m.id);else next.delete(m.id);return next;})}/><span className="min-w-0 flex-1">{m.name}</span>{m.comAcesso===false&&<span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">sem acesso de voluntário</span>}</label>)}
  </div>
  <div className="flex flex-wrap items-center gap-3">
   <button type="button" disabled={pending||!selected.size} className="rounded-lg bg-na-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>enviar([...selected])}>{pending?'Liberando…':`Liberar selecionados (${selected.size})`}</button>
   <button type="button" onClick={()=>setSelected(new Set())} disabled={pending} className="py-2 text-xs">Limpar seleção</button>
  </div>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {liberaveis.length>0&&<div className="space-y-2 rounded-lg border border-na-green/40 bg-na-green-light/40 p-3 dark:bg-emerald-950/20">
   <p className="text-sm">{lista(liberaveis.map(p=>p.nome))} ainda não {liberaveis.length===1?'tem':'têm'} acesso de voluntário. Você pode liberar: o acesso vale para a área de voluntários do Portal, não só para este evento.</p>
   <div className="flex flex-wrap items-center gap-3">
    <button type="button" disabled={pending} className="rounded-lg bg-na-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>{const ids=liberaveis.map(p=>p.id);setLiberaveis([]);enviar(ids,ids);}}>Liberar o acesso e incluir</button>
    <button type="button" disabled={pending} className="py-2 text-xs" onClick={()=>setLiberaveis([])}>Agora não</button>
   </div>
  </div>}
 </div>;
}
