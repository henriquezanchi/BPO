export interface MeetingInput {
  title:string; startsLocal:string; endsLocal:string; timeZone:string;
  repeatUntil?:string; publicDetails:string; internalDetails:string; fullUniform:boolean;
}
export function localInZone(date:Date,timeZone:string) {
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=(key:string)=>parts.find(part=>part.type===key)!.value;
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function parseLocal(local:string,timeZone:string) {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new Error('Informe data e horário completos.');
 const wall=Date.parse(local+'Z');if(!Number.isFinite(wall))throw new Error('Data inválida.');
 let instant=wall;
 for(let i=0;i<3;i++)instant+=wall-Date.parse(localInZone(new Date(instant),timeZone)+'Z');
 const date=new Date(instant);
 if(localInZone(date,timeZone)!==local)throw new Error('Esse horário não existe no fuso escolhido. Escolha outro horário.');
 return date;
}
export function shiftLocal(local:string,days:number) {
 const date=new Date(local+'Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,16);
}
export function meetingOccurrences(input:MeetingInput, now=Date.now()) {
 if(!input.title?.trim()||input.title.length>120)throw new Error('Informe um título de até 120 caracteres.');
 if(input.publicDetails.length>2000||input.internalDetails.length>2000)throw new Error('Resuma as características em até 2000 caracteres.');
 if(typeof input.fullUniform!=='boolean')throw new Error('Indique se a reunião exige traje completo.');
 const start=parseLocal(input.startsLocal,input.timeZone),end=parseLocal(input.endsLocal,input.timeZone);
 if(start.getTime()<now)throw new Error('Escolha um início futuro.');
 if(end<=start||end.getTime()-start.getTime()>24*3600000)throw new Error('O término deve ser após o início, dentro de 24 horas.');
 if(input.repeatUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(input.repeatUntil)||input.repeatUntil<input.startsLocal.slice(0,10)))throw new Error('Confira a data final da repetição.');
 const occurrences=[];
 for(let week=0;week<53;week++) {
  const local=shiftLocal(input.startsLocal,week*7);
  if(week>0&&(!input.repeatUntil||local.slice(0,10)>input.repeatUntil))break;
  if(week===52)throw new Error('Crie no máximo 52 reuniões semanais por vez.');
  occurrences.push({startsAt:parseLocal(local,input.timeZone),endsAt:parseLocal(shiftLocal(input.endsLocal,week*7),input.timeZone)});
 }
 return occurrences;
}
export function validMeetingResponse(response:string,justification:string) {
 if(!['confirmado','ausencia_justificada'].includes(response))throw new Error('Escolha confirmar ou justificar ausência.');
 if(response==='ausencia_justificada'&&(!justification.trim()||justification.length>600))throw new Error('Informe uma justificativa breve de até 600 caracteres, sem informações íntimas.');
}
