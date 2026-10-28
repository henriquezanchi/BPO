import {temAcessoVoluntario} from '@/lib/acesso-voluntario';
import {db} from '@/lib/db';
import {getAuthenticatedMember} from '@/lib/auth';
import {inscritosDoEventoUlisses,ulissesApiConfigurada,type InscritoUlisses} from '@/lib/ulisses/inscritos';

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
 const registrations=await db.eventRegistration.findMany({where:{eventId,desistenciaEm:null},select:{id:true,paid:true,paymentState:true,checkedIn:true,checkedInAt:true,selfReportedAttendance:true,member:{select:{name:true,registrationNo:true}},mercurioStatus:true},orderBy:{member:{name:'asc'}}});
 // Evento do Ulisses (27/10/2026): a inscrição é feita lá; a lista vem na hora da API do Ulisses (lib/ulisses/inscritos.ts).
 let ulisses:InscritoUlisses[]|null=null,ulissesErro:string|null=null;
 if(event.source==='ulisses'){
  if(!ulissesApiConfigurada())ulissesErro='A consulta aos inscritos do Ulisses ainda não foi configurada no Portal.';
  else ulisses=await inscritosDoEventoUlisses(event,{fresco:true}).catch(e=>{console.error('Recepção: inscritos do Ulisses indisponíveis:',e instanceof Error?e.message:e);ulissesErro='O Ulisses não respondeu agora. Tente de novo em instantes.';return null;});
 }
 return {id:event.id,title:event.title,startsAt:event.startsAt,status:event.status,price:Number(event.price),source:event.source,registrations,ulisses,ulissesErro};
}
