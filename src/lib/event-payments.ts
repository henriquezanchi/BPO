import {avisarSemEsperar} from '@/lib/push';
import {db} from '@/lib/db';
import {eventNoticePlan} from '@/lib/event-policy';
import {avisarFinanceiroSemEsperar,whatsappFinanceiroAtivo} from '@/lib/whatsapp/financeiro';
import {dataEHora,nomeCurtoDaFilial,primeiroNome} from '@/lib/whatsapp/modelos';
export async function confirmEventPayment(registrationId:string) {
 const pago=await db.$transaction(async tx=>{
  const changed=await tx.eventRegistration.updateMany({where:{id:registrationId,paid:false,paymentState:{not:'reembolsado'}},data:{paid:true,paidAt:new Date(),paymentState:'pago'}});
  if(!changed.count)return null;
  const registration=await tx.eventRegistration.findUniqueOrThrow({where:{id:registrationId},include:{event:true}});
  await tx.eventAudit.create({data:{eventId:registration.eventId,actorId:'gateway',action:'pagamento_confirmado',changes:{registrationId}}});
  if(registration.event.status==='cancelado'&&registration.event.refundOnCancellation)await tx.eventRegistration.updateMany({where:{id:registrationId,refundState:{not:'reembolsado'}},data:{refundState:'pendente',refundNextAttemptAt:new Date()}});
  if(registration.event.status==='publicado')await tx.eventNotice.createMany({data:eventNoticePlan(registration.event.startsAt,registration.event.endsAt??registration.event.startsAt).map(n=>({...n,registrationId})),skipDuplicates:true});
  return {memberId:registration.memberId,titulo:registration.event.title,schoolId:registration.event.schoolId,inicio:registration.event.startsAt};
 });
 // Aviso push (2026-10-21); uma falha no push não afeta a confirmação.
 if(pago)await avisarSemEsperar([pago.memberId],{titulo:'Inscrição confirmada',corpo:`Pagamento recebido: você está inscrito em "${pago.titulo}".`,url:'/eventos',etiqueta:`inscricao-${registrationId}`});
 // WhatsApp do financeiro (2026-10-26), pelo número central, quando estiver ligado.
 if(pago&&whatsappFinanceiroAtivo())try{
  const {fusoDaEscola}=await import('@/lib/atendimentos');
  const m=await db.member.findUniqueOrThrow({where:{id:pago.memberId},select:{name:true,whatsapp:true,schoolId:true}});
  const escola=await db.school.findUniqueOrThrow({where:{id:pago.schoolId??m.schoolId},select:{id:true,name:true,uf:true}});
  await avisarFinanceiroSemEsperar({schoolId:escola.id,memberId:pago.memberId,telefone:m.whatsapp,modelo:'na_inscricao_confirmada',parametros:[primeiroNome(m.name),pago.titulo,nomeCurtoDaFilial(escola.name),dataEHora(pago.inicio,fusoDaEscola(escola.uf))],referencia:`inscricao:${registrationId}:paga`});
 }catch(e){console.error('WhatsApp do financeiro (inscrição):',e);}
}
