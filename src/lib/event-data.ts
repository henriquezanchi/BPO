import {temAcessoVoluntario} from '@/lib/acesso-voluntario';
import {db} from '@/lib/db';
import {getAuthenticatedMember} from '@/lib/auth';

export async function requireEventReception(eventId:string) {
 const actor=await getAuthenticatedMember();
 if(!actor?.mercurioAtivo)throw Error('Entre com seu acesso ativo ao Portal.');
 const event=await db.event.findUniqueOrThrow({where:{id:eventId}});
 const director=actor.schoolId===event.schoolId&&(actor.isDiretor||actor.isSubChefe);
 if(!director&&!await temAcessoVoluntario(actor))throw Error('Acesso de voluntário não liberado.');
 if(!director&&!await db.eventReception.count({where:{eventId,memberId:actor.id}}))throw Error('Você não foi designado para a recepção deste evento.');
 return {event,actor};
}
export async function getEventReception(eventId:string) {
 const {event}=await requireEventReception(eventId);
 const registrations=await db.eventRegistration.findMany({where:{eventId},select:{id:true,paid:true,paymentState:true,checkedIn:true,checkedInAt:true,selfReportedAttendance:true,member:{select:{name:true,registrationNo:true}},mercurioStatus:true},orderBy:{member:{name:'asc'}}});
 return {id:event.id,title:event.title,startsAt:event.startsAt,status:event.status,price:Number(event.price),registrations};
}
