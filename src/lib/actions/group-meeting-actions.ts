"use server";

import {randomUUID} from "node:crypto";
import {requireAuthenticatedMember,requireTeacherOfClass} from "@/lib/auth";
import {temAcessoVoluntario} from "@/lib/acesso-voluntario";
import {db} from "@/lib/db";
import {meetingOccurrences,localInZone,parseLocal,shiftLocal,validMeetingResponse,type MeetingInput} from "@/lib/group-meetings";
import {revalidatePath} from "next/cache";

async function leader(groupId:string) {
 const actor=await requireTeacherOfClass(groupId);
 if(!actor.mercurioAtivo)throw new Error('Cadastro inativo.');
 const group=await db.classGroup.findUniqueOrThrow({where:{id:groupId},select:{tipo:true}});
 if(!['BF','BM','CS'].includes(group.tipo))throw new Error('Reuniões disponíveis somente para brigadas.');
 return actor;
}
function refresh(groupId:string) {revalidatePath(`/professor/turma/${groupId}`);revalidatePath('/portal');}
function fields(input:MeetingInput) {return {title:input.title.trim(),timeZone:input.timeZone,publicDetails:input.publicDetails.trim(),internalDetails:input.internalDetails.trim(),fullUniform:input.fullUniform,required:true};}
export async function createGroupMeetings(groupId:string,input:MeetingInput) {
 const actor=await leader(groupId);const dates=meetingOccurrences(input);const seriesId=input.repeatUntil?randomUUID():null;
 await db.$transaction(async tx=>{
  for(const date of dates){
   const row=await tx.groupMeeting.create({data:{classGroupId:groupId,createdById:actor.id,seriesId,...date,...fields(input)}});
   await tx.groupMeetingAudit.create({data:{meetingId:row.id,actorId:actor.id,action:'criada',changes:{title:row.title,startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),publicDetails:row.publicDetails,internalDetails:row.internalDetails,fullUniform:row.fullUniform}}});
  }
 },{timeout:30000});refresh(groupId);return {count:dates.length};
}
export async function getGroupMeetings(groupId:string) {
 await leader(groupId);
 return db.groupMeeting.findMany({where:{classGroupId:groupId,startsAt:{gte:new Date(Date.now()-30*86400000)}},orderBy:{startsAt:'asc'},include:{responses:{select:{memberId:true,response:true,justification:true,updatedAt:true,member:{select:{name:true}}}}}});
}
export async function changeGroupMeeting(id:string,version:number,scope:'esta'|'seguintes',input:MeetingInput|null,cancellationReason?:string) {
 if(!Number.isSafeInteger(version)||version<0)throw new Error('Versão de reunião inválida.');
 const anchor=await db.groupMeeting.findUniqueOrThrow({where:{id}});const actor=await leader(anchor.classGroupId);
 if(!['esta','seguintes'].includes(scope))throw new Error('Escolha o alcance da alteração.');
 if(anchor.status!=='agendada'||anchor.startsAt<=new Date())throw new Error('Só é possível alterar reuniões futuras agendadas.');
 if(!input&&(!cancellationReason?.trim()||cancellationReason.length>300))throw new Error('Informe o motivo do cancelamento, em até 300 caracteres.');
 if(input)meetingOccurrences({...input,repeatUntil:undefined});
 const selected=scope==='seguintes'&&anchor.seriesId?{seriesId:anchor.seriesId,classGroupId:anchor.classGroupId,startsAt:{gte:anchor.startsAt},status:'agendada'}:{id};
 await db.$transaction(async tx=>{
  const lock=await tx.groupMeeting.updateMany({where:{id,version},data:{version:{increment:1}}});
  if(lock.count!==1)throw new Error('A reunião mudou em outra sessão. Atualize antes de editar.');
  const rows=await tx.groupMeeting.findMany({where:selected,include:{responses:true}});
  for(const row of rows){
   let dates={startsAt:row.startsAt,endsAt:row.endsAt};
   if(input){
    const a=localInZone(anchor.startsAt,anchor.timeZone).slice(0,10),b=localInZone(row.startsAt,anchor.timeZone).slice(0,10);
    const days=Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
    dates={startsAt:parseLocal(shiftLocal(input.startsLocal,days),input.timeZone),endsAt:parseLocal(shiftLocal(input.endsLocal,days),input.timeZone)};
   }
   await tx.groupMeeting.update({where:{id:row.id},data:input?{...fields(input),...dates,version:{increment:1}}:{status:'cancelada',cancellationReason:cancellationReason!.trim(),version:{increment:1}}});
   // A confirmação anterior não é transportada para outro horário.
   if(input&&(row.startsAt.getTime()!==dates.startsAt.getTime()||row.endsAt.getTime()!==dates.endsAt.getTime()))await tx.groupMeetingResponse.deleteMany({where:{meetingId:row.id}});
   await tx.groupMeetingAudit.create({data:{meetingId:row.id,actorId:actor.id,action:input?'alterada':'cancelada',changes:{before:{title:row.title,startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),publicDetails:row.publicDetails,internalDetails:row.internalDetails,fullUniform:row.fullUniform},after:input?{...fields(input),startsAt:dates.startsAt.toISOString(),endsAt:dates.endsAt.toISOString()}:{reason:cancellationReason!},previousResponses:row.responses.map(response=>({memberId:response.memberId,response:response.response,justification:response.justification,updatedAt:response.updatedAt.toISOString()}))}}});
  }
 },{timeout:30000});refresh(anchor.classGroupId);return {ok:true};
}
export async function respondGroupMeeting(memberId:string,id:string,response:string,justification:string,meetingVersion:number) {
 const member=await requireAuthenticatedMember(memberId);
 if(!member.mercurioAtivo||!await temAcessoVoluntario(member))throw new Error('Acesso à área de voluntários não liberado.');
 if(!Number.isSafeInteger(meetingVersion)||meetingVersion<0)throw new Error('Versão de convocação inválida.');
 validMeetingResponse(response,justification);
 await db.$transaction(async tx=>{
  const lock=await tx.groupMeeting.updateMany({where:{id,version:meetingVersion,status:'agendada'},data:{version:meetingVersion}});
  if(lock.count!==1)throw new Error('A convocação mudou. Atualize a agenda antes de responder.');
  const meeting=await tx.groupMeeting.findUniqueOrThrow({where:{id}});
  if(meeting.status!=='agendada'||meeting.endsAt<new Date())throw new Error('Reunião encerrada ou cancelada.');
  if(!await tx.classMembership.count({where:{classGroupId:meeting.classGroupId,memberId,role:'aluno'}}))throw new Error('Você não integra este grupo.');
  const data={response,justification:response==='ausencia_justificada'?justification.trim():null};
  await tx.groupMeetingResponse.upsert({where:{meetingId_memberId:{meetingId:id,memberId}},create:{meetingId:id,memberId,...data},update:data});
  // O histórico preserva a justificativa, inclusive quando uma nova resposta a substitui.
  await tx.groupMeetingAudit.create({data:{meetingId:id,actorId:memberId,action:'resposta',changes:data}});
 });revalidatePath('/portal');return {ok:true};
}
