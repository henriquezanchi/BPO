import {randomUUID} from "node:crypto";
import {db} from "@/lib/db";
import type {Prisma,GroupMeetingSeries} from "@prisma/client";
import {seriesOccurrences,type WeeklySegment} from "@/lib/group-meetings";

type Store=Pick<Prisma.TransactionClient,'groupMeeting'|'groupMeetingAudit'>;
export async function materializeMeetingSeries(store:Store,series:GroupMeetingSeries,from=Date.now()) {
 const dates=seriesOccurrences({...series,changes:series.changes as unknown as WeeklySegment[],intervalWeeks:series.intervaloSemanas},from);
 if(!dates.length)return 0;
 const rows=dates.map(date=>{
  const template=(date.segment.template??series.template) as {title:string;publicDetails:string;internalDetails:string;fullUniform:boolean};
  return {id:randomUUID(),classGroupId:series.classGroupId,createdById:series.createdById,seriesId:series.id,seriesSlot:date.seriesSlot,title:template.title,publicDetails:template.publicDetails,internalDetails:template.internalDetails,fullUniform:template.fullUniform,timeZone:date.segment.timeZone,required:true,startsAt:date.startsAt,endsAt:date.endsAt};
 });
 const existing=await store.groupMeeting.findMany({where:{seriesId:series.id,seriesSlot:{in:rows.map(row=>row.seriesSlot)}},select:{seriesSlot:true}});
 const existingSlots=new Set(existing.map(row=>row.seriesSlot));
 const missing=rows.filter(row=>!existingSlots.has(row.seriesSlot));
 if(!missing.length)return 0;
 const created=await store.groupMeeting.createManyAndReturn({data:missing,skipDuplicates:true,select:{id:true}});
 if(created.length)await store.groupMeetingAudit.createMany({data:created.map(item=>{
  const row=rows.find(row=>row.id===item.id)!;
  return {meetingId:row.id,actorId:series.createdById,action:'gerada_da_rotina',changes:{seriesId:series.id,title:row.title,startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),publicDetails:row.publicDetails,internalDetails:row.internalDetails,fullUniform:row.fullUniform}};
 })});
 return created.length;
}
/** Chamado somente depois da autenticação e seleção dos grupos permitidos. */
export async function ensureGroupMeetingWindow(groupIds:string[]) {
 if(!groupIds.length)return;
 const series=await db.groupMeetingSeries.findMany({where:{classGroupId:{in:groupIds}}});
 if(!series.length)return;
 // Desempenho (31/10/2026): roda em todo acesso ao Portal. Antes travava e gravava cada série mesmo sem nada a gerar;
 // agora confere numa leitura só se falta algum encontro na janela e abre a transação apenas para as séries incompletas.
 const agora=Date.now();
 const esperadas=series.map(s=>({s,slots:seriesOccurrences({...s,changes:s.changes as unknown as WeeklySegment[],intervalWeeks:s.intervaloSemanas},agora).map(d=>d.seriesSlot)}));
 const todos=esperadas.flatMap(e=>e.slots);
 const jaTem=todos.length?await db.groupMeeting.findMany({where:{seriesId:{in:series.map(s=>s.id)},seriesSlot:{in:todos}},select:{seriesId:true,seriesSlot:true}}):[];
 const existe=new Set(jaTem.map(e=>`${e.seriesId}|${e.seriesSlot}`));
 const incompletas=esperadas.filter(e=>e.slots.some(slot=>!existe.has(`${e.s.id}|${slot}`))).map(e=>e.s);
 for(const item of incompletas)await db.$transaction(async tx=>{
  const current=await tx.groupMeetingSeries.update({where:{id:item.id},data:{id:item.id}});
  return materializeMeetingSeries(tx,current);
 },{timeout:30000});
}
