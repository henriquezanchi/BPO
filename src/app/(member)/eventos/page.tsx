import {getAuthenticatedMember} from '@/lib/auth';
import {db} from '@/lib/db';
import {EventAttendanceReply} from '@/components/member/event-attendance-reply';
import Link from 'next/link';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){
 const member=await getAuthenticatedMember();if(!member)redirect('/login?next=/eventos');if(!member.mercurioAtivo)redirect('/portal');
 const [registrations,reception]=await Promise.all([
  db.eventRegistration.findMany({where:{memberId:member.id},include:{event:true},orderBy:{event:{startsAt:'desc'}}}),
  db.eventReception.findMany({where:{memberId:member.id},include:{event:true},orderBy:{event:{startsAt:'desc'}}}),
 ]);
 return <main className="mx-auto max-w-2xl space-y-6 p-4"><Link href="/portal" className="text-sm text-na-green dark:text-emerald-400">← Portal do Aluno</Link><h1 className="text-xl font-bold">Meus eventos</h1><p className="text-sm text-gray-500">Os avisos por WhatsApp ainda aguardam conexão. Confira aqui suas inscrições e os horários.</p>
 {!!reception.length&&<section className="space-y-3"><h2 className="font-bold">Minha equipe de recepção</h2>{reception.map(r=><Link key={r.id} href={`/eventos/${r.eventId}/recepcao`} className="block rounded-xl border p-4 text-sm">{r.event.title} → Abrir recepção</Link>)}</section>}
 <section className="space-y-3"><h2 className="font-bold">Inscrições e participação</h2>{!registrations.length&&<p className="text-sm text-gray-500">Você ainda não tem inscrições pelo Portal. Os próximos eventos ficam na Agenda.</p>}{registrations.map(r=><article key={r.id} className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"><h3 className="font-semibold">{r.event.title}</h3><p className="text-sm">{r.event.startsAt.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}</p><p className="text-sm">{r.event.status==='cancelado'?'Evento cancelado. Consulte a Economia sobre pagamentos e eventual estorno.':r.paid?(Number(r.event.price)?'Inscrição paga':'Inscrição gratuita confirmada'):r.paymentState==='revisao'?'Cobrança em conferência. Procure a Economia antes de tentar outro pagamento.':'Inscrição aguardando pagamento'}</p><p className="text-sm">{r.checkedIn?'Presença conferida pela recepção':'Presença ainda não conferida'}{r.selfReportedAttendance?` · Sua resposta: ${r.selfReportedAttendance==='sim'?'participei':'não participei'}`:''}</p>{r.checkedIn&&<p className="text-xs text-gray-500">Salvo no histórico do Portal. Registro no Mercúrio: aguardando integração.</p>}{r.paid&&r.event.status==='publicado'&&(r.event.endsAt??r.event.startsAt)<new Date()&&!member.isJanos&&<EventAttendanceReply memberId={member.id} registrationId={r.id}/>}</article>)}</section>
 </main>;
}
