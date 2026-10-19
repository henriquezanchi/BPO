export interface MeetingInput {
  title:string; startsLocal:string; endsLocal:string; timeZone:string;
  weekly?:boolean; repeatUntil?:string; publicDetails:string; internalDetails:string; fullUniform:boolean;
  /** 1 = semanal (padrão), 2 = quinzenal, 4 = a cada 4 semanas. */
  intervalWeeks?:number;
}
export function localInZone(date:Date,timeZone:string) {
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=(key:string)=>parts.find(part=>part.type===key)!.value;
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function parseLocal(local:string,timeZone:string) {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new MeetingError('Informe data e horário completos.');
 const wall=Date.parse(local+'Z');if(!Number.isFinite(wall))throw new MeetingError('Data inválida.');
 let instant=wall;
 for(let i=0;i<3;i++)instant+=wall-Date.parse(localInZone(new Date(instant),timeZone)+'Z');
 const date=new Date(instant);
 if(localInZone(date,timeZone)!==local)throw new MeetingError('Esse horário não existe no fuso escolhido. Escolha outro horário.');
 return date;
}
export function shiftLocal(local:string,days:number) {
 const date=new Date(local+'Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,16);
}
export class MeetingError extends Error {}
export function validateMeeting(input:MeetingInput, now=Date.now()) {
 if(!input.title?.trim()||input.title.length>120)throw new MeetingError('Informe um título de até 120 caracteres.');
 if(input.publicDetails.length>2000||input.internalDetails.length>2000)throw new MeetingError('Resuma as características em até 2000 caracteres.');
 if(typeof input.fullUniform!=='boolean')throw new MeetingError('Indique se a reunião exige traje completo.');
 if(input.intervalWeeks!==undefined&&![1,2,4].includes(input.intervalWeeks))throw new MeetingError('Frequência inválida: semanal, quinzenal ou a cada 4 semanas.');
 const start=parseLocal(input.startsLocal,input.timeZone),end=parseLocal(input.endsLocal,input.timeZone);
 if(start.getTime()<now)throw new MeetingError('Escolha um início futuro.');
 if(end<=start||end.getTime()-start.getTime()>24*3600000)throw new MeetingError('O término deve ser após o início, dentro de 24 horas.');
 return {startsAt:start,endsAt:end};
}
/** Janela de exibição; a série persistida não expira quando esta janela acaba. */
export interface WeeklySegment {fromSlot:string;startsLocal:string;endsLocal:string;timeZone:string;template?:Record<string,unknown>}
export interface WeeklySeries {startsLocal:string;endsLocal:string;timeZone:string;untilSlot:string|null;changes?:WeeklySegment[];intervalWeeks?:number}
export function seriesOccurrences(series:WeeklySeries,from=Date.now(),weeks=12) {
 const bySlot=new Map<string,WeeklySegment>();
 bySlot.set(series.startsLocal,{fromSlot:series.startsLocal,startsLocal:series.startsLocal,endsLocal:series.endsLocal,timeZone:series.timeZone});
 for(const change of series.changes??[])bySlot.set(change.fromSlot,change);
 const segments=[...bySlot.values()].sort((a,b)=>a.fromSlot.localeCompare(b.fromSlot));
 const rows=[];
 const step=7*(series.intervalWeeks??1);
 for(let i=0;i<segments.length;i++){
  const segment=segments[i];
  const boundary=[series.untilSlot,segments[i+1]?.fromSlot].filter(Boolean).sort()[0];
  const today=localInZone(new Date(from),segment.timeZone).slice(0,10);
  const elapsed=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(segment.startsLocal.slice(0,10)+'T00:00:00Z'))/(step*86400000));
  for(let week=Math.max(0,elapsed);week<Math.max(0,elapsed)+weeks+1;week++){
   const slot=shiftLocal(segment.fromSlot,week*step);
   if(boundary&&slot>=boundary)break;
   const startsAt=parseLocal(shiftLocal(segment.startsLocal,week*step),segment.timeZone),endsAt=parseLocal(shiftLocal(segment.endsLocal,week*step),segment.timeZone);
   if(endsAt.getTime()<from)continue;
   rows.push({seriesSlot:slot,startsAt,endsAt,segment});
  }
 }
 return rows.sort((a,b)=>a.startsAt.getTime()-b.startsAt.getTime()).slice(0,weeks);
}
export function meetingOccurrences(input:MeetingInput,now=Date.now()) {
 const first=validateMeeting(input,now);
 return input.weekly ? seriesOccurrences({...input,untilSlot:null},now):[first];
}
export function validMeetingResponse(response:string,justification:string) {
 if(!['confirmado','ausencia_justificada'].includes(response))throw new MeetingError('Escolha confirmar ou justificar ausência.');
 if(response==='ausencia_justificada'&&(!justification.trim()||justification.length>600))throw new MeetingError('Informe uma justificativa breve de até 600 caracteres, sem informações íntimas.');
}
