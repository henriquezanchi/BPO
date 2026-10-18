import {db} from '@/lib/db';
import {eventNoticePlan} from '@/lib/event-policy';
export async function confirmEventPayment(registrationId:string) {
 await db.$transaction(async tx=>{
  const changed=await tx.eventRegistration.updateMany({where:{id:registrationId,paid:false},data:{paid:true,paidAt:new Date(),paymentState:'pago'}});
  if(!changed.count)return;
  const registration=await tx.eventRegistration.findUniqueOrThrow({where:{id:registrationId},include:{event:true}});
  await tx.eventAudit.create({data:{eventId:registration.eventId,actorId:'gateway',action:'pagamento_confirmado',changes:{registrationId}}});
  if(registration.event.status==='publicado')await tx.eventNotice.createMany({data:eventNoticePlan(registration.event.startsAt,registration.event.endsAt??registration.event.startsAt).map(n=>({...n,registrationId})),skipDuplicates:true});
 });
}
