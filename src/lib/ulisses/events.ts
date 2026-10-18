import {safeEventRegistrationUrl} from '@/lib/event-policy';
// DTOs limitados aos campos já usados pela integração oficial do CRM.
export interface UlissesEvent {id:number;nome:string;linkFinal?:string;dadoPequeno?:string;dadoMedio?:string;dadoGrande?:string;dadoFinal?:string;filiaisEventos?:{ativo?:boolean;filial?:{id:number;nome?:string};produtos?:{id?:number;dataEvento?:number|string}[]}[]}
export function ulissesOccurrences(event:UlissesEvent,branchId:number,schoolId:string) {
 if(!Number.isSafeInteger(event.id)||!event.nome?.trim())throw Error('Evento do Ulisses sem identificação válida.');
 const description=[event.dadoPequeno,event.dadoMedio,event.dadoGrande,event.dadoFinal].filter(Boolean).join('\n\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
 return (event.filiaisEventos??[]).filter(branch=>branch.filial?.id===branchId).flatMap(branch=>(branch.produtos??[]).flatMap(product=>{
  if(!product.dataEvento)return [];
  const startsAt=new Date(product.dataEvento);if(!Number.isFinite(startsAt.getTime()))throw Error('Data de evento inválida no Ulisses.');
  return [{externalUid:`ulisses:${event.id}:${branchId}:${product.id??startsAt.toISOString()}`,schoolId,source:'ulisses',scope:'filial',audience:'todos_ativos',status:branch.ativo===false?'cancelado':'publicado',title:event.nome.trim(),description,registrationUrl:safeEventRegistrationUrl(event.linkFinal),startsAt,location:branch.filial?.nome??null,price:0}];
 }));
}
