"use server";

import {requireAuthenticatedMember,requireTeacherOfClass} from "@/lib/auth";
import {temAcessoVoluntario} from "@/lib/acesso-voluntario";
import {db} from "@/lib/db";
import {validateMeeting,localInZone,parseLocal,shiftLocal,validMeetingResponse,MeetingError,type MeetingInput,type WeeklySegment} from "@/lib/group-meetings";
import {ensureGroupMeetingWindow,materializeMeetingSeries} from "@/lib/meeting-series";
import {revalidatePath} from "next/cache";

async function leader(groupId:string) {
 const actor=await requireTeacherOfClass(groupId);
 if(!actor.mercurioAtivo)throw new MeetingError('Cadastro inativo.');
 const group=await db.classGroup.findUniqueOrThrow({where:{id:groupId},select:{tipo:true}});
 if(!['BF','BM','CS'].includes(group.tipo))throw new MeetingError('Reuniões disponíveis somente para grupos de voluntários.');
 return actor;
}
function refresh(groupId:string) {revalidatePath(`/professor/turma/${groupId}`);revalidatePath('/portal');}
function fields(input:MeetingInput) {return {title:input.title.trim(),timeZone:input.timeZone,publicDetails:input.publicDetails.trim(),internalDetails:input.internalDetails.trim(),fullUniform:input.fullUniform,required:true};}
async function createMeeting(groupId:string,input:MeetingInput) {
 const actor=await leader(groupId);const date=validateMeeting(input);const weekly=input.weekly??!!input.repeatUntil;
 const count=await db.$transaction(async tx=>{
  if(weekly){
   const series=await tx.groupMeetingSeries.create({data:{classGroupId:groupId,createdById:actor.id,startsLocal:input.startsLocal,endsLocal:input.endsLocal,timeZone:input.timeZone,template:fields(input)}});
   return materializeMeetingSeries(tx,series);
  }
  const row=await tx.groupMeeting.create({data:{classGroupId:groupId,createdById:actor.id,...date,...fields(input)}});
  await tx.groupMeetingAudit.create({data:{meetingId:row.id,actorId:actor.id,action:'criada',changes:{title:row.title,startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),publicDetails:row.publicDetails,internalDetails:row.internalDetails,fullUniform:row.fullUniform}}});
  return 1;
 },{timeout:30000});refresh(groupId);return {count,weekly};
}
export async function getGroupMeetings(groupId:string) {
 await leader(groupId);
 await ensureGroupMeetingWindow([groupId]);
 return db.groupMeeting.findMany({where:{classGroupId:groupId,startsAt:{gte:new Date(Date.now()-30*86400000)}},orderBy:{startsAt:'asc'},include:{responses:{select:{memberId:true,response:true,justification:true,updatedAt:true,member:{select:{name:true}}}}}});
}
async function changeMeeting(id:string,version:number,scope:'esta'|'seguintes',input:MeetingInput|null,cancellationReason?:string) {
 if(!Number.isSafeInteger(version)||version<0)throw new MeetingError('Versão de reunião inválida.');
 const anchor=await db.groupMeeting.findUniqueOrThrow({where:{id}});const actor=await leader(anchor.classGroupId);
 if(!['esta','seguintes'].includes(scope))throw new MeetingError('Escolha o alcance da alteração.');
 if(anchor.status!=='agendada'||anchor.startsAt<=new Date())throw new MeetingError('Só é possível alterar reuniões futuras agendadas.');
 if(!input&&(!cancellationReason?.trim()||cancellationReason.length>300))throw new MeetingError('Informe o motivo do cancelamento, em até 300 caracteres.');
 if(input)validateMeeting(input);
 const slot=anchor.seriesSlot??localInZone(anchor.startsAt,anchor.timeZone);
 const selected=scope==='seguintes'&&anchor.seriesId?{seriesId:anchor.seriesId,classGroupId:anchor.classGroupId,...(anchor.seriesSlot?{seriesSlot:{gte:slot}}:{startsAt:{gte:anchor.startsAt}}),status:'agendada'}:{id};
 await db.$transaction(async tx=>{
  if(anchor.seriesId)await tx.groupMeetingSeries.updateMany({where:{id:anchor.seriesId},data:{id:anchor.seriesId}});
  const lock=await tx.groupMeeting.updateMany({where:{id,version},data:{version:{increment:1}}});
  if(lock.count!==1)throw new MeetingError('A reunião mudou em outra sessão. Atualize antes de editar.');
  if(scope==='seguintes'&&anchor.seriesId){
   const series=await tx.groupMeetingSeries.findUnique({where:{id:anchor.seriesId}});
   if(series){
    if(input){
     const changes=(series.changes as unknown as WeeklySegment[]).filter(change=>change.fromSlot<slot);
     changes.push({fromSlot:slot,startsLocal:input.startsLocal,endsLocal:input.endsLocal,timeZone:input.timeZone,template:fields(input)});
     await tx.groupMeetingSeries.update({where:{id:series.id},data:{changes:JSON.parse(JSON.stringify(changes))}});
    }else await tx.groupMeetingSeries.update({where:{id:series.id},data:{untilSlot:slot}});
   }
  }
  const rows=await tx.groupMeeting.findMany({where:selected,include:{responses:true}});
  for(const row of rows){
   let dates={startsAt:row.startsAt,endsAt:row.endsAt};
   if(input){
    const a=slot.slice(0,10),b=(row.seriesSlot??localInZone(row.startsAt,anchor.timeZone)).slice(0,10);
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
async function respondMeeting(memberId:string,id:string,response:string,justification:string,meetingVersion:number) {
 const member=await requireAuthenticatedMember(memberId);
 if(!member.mercurioAtivo||!await temAcessoVoluntario(member))throw new MeetingError('Acesso à área de voluntários não liberado.');
 if(!Number.isSafeInteger(meetingVersion)||meetingVersion<0)throw new MeetingError('Versão de convocação inválida.');
 validMeetingResponse(response,justification);
 await db.$transaction(async tx=>{
  const lock=await tx.groupMeeting.updateMany({where:{id,version:meetingVersion,status:'agendada'},data:{version:meetingVersion}});
  if(lock.count!==1)throw new MeetingError('A convocação mudou. Atualize a agenda antes de responder.');
  const meeting=await tx.groupMeeting.findUniqueOrThrow({where:{id}});
  if(meeting.status!=='agendada'||meeting.endsAt<new Date())throw new MeetingError('Reunião encerrada ou cancelada.');
  if(!await tx.classMembership.count({where:{classGroupId:meeting.classGroupId,memberId,role:'aluno'}}))throw new MeetingError('Você não integra este grupo.');
  const data={response,justification:response==='ausencia_justificada'?justification.trim():null};
  await tx.groupMeetingResponse.upsert({where:{meetingId_memberId:{meetingId:id,memberId}},create:{meetingId:id,memberId,...data},update:data});
  // O histórico preserva a justificativa, inclusive quando uma nova resposta a substitui.
  await tx.groupMeetingAudit.create({data:{meetingId:id,actorId:memberId,action:'resposta',changes:data}});
 });revalidatePath('/portal');return {ok:true};
}

async function meetingResult<T extends object>(operation:()=>Promise<T>) {
 try{return {ok:true as const,...await operation()};}
 catch(error){
  if(error instanceof MeetingError)return {ok:false as const,error:error.message};
  const message=error instanceof Error?error.message:'';
  if(['Não autenticado.','Você não é professor desta turma.','Seu acesso à área de voluntários ainda não foi liberado.'].includes(message))return {ok:false as const,error:message};
  console.error('[Reuniões] Falha de operação',error instanceof Error?error.name:'erro');
  return {ok:false as const,error:'Não foi possível concluir. Atualize a página e tente novamente.'};
 }
}
export async function createGroupMeetings(groupId:string,input:MeetingInput){return meetingResult(()=>createMeeting(groupId,input));}
export async function changeGroupMeeting(id:string,version:number,scope:'esta'|'seguintes',input:MeetingInput|null,reason?:string){return meetingResult(()=>changeMeeting(id,version,scope,input,reason));}
export async function respondGroupMeeting(memberId:string,id:string,response:string,justification:string,version:number){return meetingResult(()=>respondMeeting(memberId,id,response,justification,version));}
