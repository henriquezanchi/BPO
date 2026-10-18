"use client";
import {declararComparecimento} from '@/lib/actions/event-actions';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function EventAttendanceReply({memberId,registrationId}:{memberId:string;registrationId:string}){
 const [message,setMessage]=useState(''),[pending,start]=useTransition();const router=useRouter();
 return <div className="space-y-2"><p className="text-sm">Você conseguiu participar?</p><div className="flex gap-2">{[true,false].map(value=><button key={String(value)} disabled={pending} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm disabled:opacity-50" onClick={()=>start(async()=>{try{await declararComparecimento(memberId,registrationId,value);setMessage('Resposta registrada. A recepção faz a conferência de presença.');router.refresh();}catch{setMessage('Não foi possível registrar a resposta. Tente novamente.');}})}>{value?'Sim, participei':'Não participei'}</button>)}</div>{message&&<p role="status" className="text-xs">{message}</p>}</div>;
}
