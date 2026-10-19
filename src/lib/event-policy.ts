import type { Prisma } from "@prisma/client";

export const EVENT_AUDIENCES = { todos_ativos: "Todos os alunos ativos", membros: "Membros do programa", provacionistas: "Provacionistas", voluntarios: "Voluntários com acesso liberado", direcao: "Direção da escola" };
export type EventAudience = keyof typeof EVENT_AUDIENCES;
export function eventAudienceWhere(member: {isMembroPrograma:boolean;isProvacionista:boolean;isDiretor:boolean;isSubChefe:boolean}, volunteer: boolean): Prisma.EventWhereInput {
 const allowed = ['todos_ativos', ...(member.isMembroPrograma?['membros']:[]), ...(member.isProvacionista?['provacionistas']:[]), ...(volunteer?['voluntarios']:[]), ...(member.isDiretor||member.isSubChefe?['direcao']:[])];
 // Papéis ainda não mapeados do Ágora nunca recebem acesso por aproximação.
 return {audience:{in:allowed},source:{notIn:['agora','google_calendar_nacional']}};
}
export function validateInternalEvent(input: {title:string;startsAt:string;endsAt:string;price:number;audience:string;description:string;location:string;capacity?:number|null;registrationClosesAt?:string|null;participantInstructions?:string;contactInfo?:string;posterPath?:string|null}) {
 const start=new Date(input.startsAt),end=new Date(input.endsAt);
 if(!input.title.trim()||input.title.length>160||input.description.length>5000||input.location.length>300)throw Error('Confira o título, a descrição e o local.');
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start<=new Date()||end<=start)throw Error('Informe início futuro e término depois do início.');
 if(!Number.isFinite(input.price)||input.price<0||input.price>999999.99||Math.abs(input.price*100-Math.round(input.price*100))>0.00001)throw Error('Informe uma contribuição válida, com até duas casas decimais.');
 if(!Object.hasOwn(EVENT_AUDIENCES,input.audience))throw Error('Escolha o público do evento.');
 const capacity=input.capacity??null;
 if(capacity!==null&&(!Number.isSafeInteger(capacity)||capacity<1||capacity>100000))throw Error('O limite de vagas deve ser um número inteiro entre 1 e 100.000.');
 const closes=input.registrationClosesAt?new Date(input.registrationClosesAt):null;
 if(closes&&(!Number.isFinite(closes.getTime())||closes>start))throw Error('O prazo de inscrição deve terminar até o início do evento.');
 if((input.participantInstructions?.length??0)>5000||(input.contactInfo?.length??0)>300)throw Error('Reduza as orientações ou o contato do evento.');
 return {capacity,registrationClosesAt:closes,participantInstructions:input.participantInstructions?.trim()||null,contactInfo:input.contactInfo?.trim()||null,posterPath:input.posterPath||null,title:input.title.trim(),startsAt:start,endsAt:end,price:input.price,audience:input.audience,description:input.description.trim(),location:input.location.trim()};
}
export function eventNoticePlan(startsAt:Date,endsAt:Date,now=new Date()) {
 return [{kind:'inscricao',dueAt:now},{kind:'vespera',dueAt:new Date(startsAt.getTime()-86400000)},{kind:'uma_hora',dueAt:new Date(startsAt.getTime()-3600000)},{kind:'avaliar_presenca',dueAt:new Date(endsAt.getTime()+3600000)}].filter(n=>n.dueAt>=now);
}

export function safeEventRegistrationUrl(value:string|null|undefined) {
 if(!value)return null;
 try{const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password)return null;return url.href;}catch{return null;}
}
