import {getEventReception} from '@/lib/event-data';
import {EventReception} from '@/components/member/event-reception';
import Link from 'next/link';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const data=await getEventReception(id).catch(()=>null);
 if(!data)notFound();
 return <main className="mx-auto max-w-2xl space-y-5 p-4"><Link href="/eventos" className="text-sm text-na-green dark:text-emerald-400">← Eventos</Link><h1 className="text-xl font-bold">Recepção · {data.title}</h1><p className="text-sm">{data.startsAt.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})} (Brasília){data.status==='cancelado'?' · Cancelado':''}</p><EventReception data={data}/></main>;
}
