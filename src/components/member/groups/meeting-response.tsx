"use client";
import {useState,useTransition} from "react";
import {respondGroupMeeting} from "@/lib/actions/group-meeting-actions";
export function MeetingResponse({memberId,id,version,initial}:{memberId:string;id:string;version:number;initial:string|null}) {
 const [response,setResponse]=useState(initial),[reason,setReason]=useState(''),[justifying,setJustifying]=useState(false),[error,setError]=useState(''),[pending,start]=useTransition();
 function send(value:string){setError('');start(async()=>{try{await respondGroupMeeting(memberId,id,value,reason,version);setResponse(value);setJustifying(false);}catch(e){setError((e as Error).message);}});}
 return <div className="mt-3 space-y-2 text-sm">{response&&<p role="status">{response==='confirmado'?'Presença confirmada.':'Justificativa registrada para o responsável. Não equivale a dispensa automática.'}</p>}
 <div className="flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={()=>send('confirmado')} className="min-h-11 rounded-lg bg-na-green px-3 font-semibold text-white disabled:opacity-50">Confirmar presença</button><button type="button" disabled={pending} onClick={()=>setJustifying(!justifying)} className="min-h-11 px-2 font-semibold text-na-green-dark dark:text-na-green-light">Justificar ausência</button></div>
 {justifying&&<><label className="block">Justificativa breve (somente você e os responsáveis do grupo)<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={600} className="mt-1 min-h-24 w-full rounded-lg border p-2 dark:bg-gray-900"/></label><p className="text-xs text-gray-600 dark:text-gray-300">Evite detalhes íntimos ou dados de saúde.</p><button type="button" disabled={pending||!reason.trim()} onClick={()=>send('ausencia_justificada')} className="min-h-11 font-semibold text-na-green-dark dark:text-na-green-light">Registrar justificativa</button></>}
 {error&&<p role="alert" className="text-na-danger-dark dark:text-na-danger-light">{error}</p>}</div>;
}
