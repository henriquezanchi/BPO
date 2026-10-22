import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { asaasGetPaymentStatus,asaasRefundEventPayment,asaasDeleteEventPayment } from "@/lib/asaas/client";
import { refundErrorMessage,refundPosition } from "@/lib/event-refund-policy";

/** Reembolsa quando a filial cancelou o evento com devolução ou quando o próprio aluno desistiu no prazo (2026-10-22). */
const ELEGIVEL={OR:[{event:{source:'manual',status:'cancelado',refundOnCancellation:true}},{desistenciaEm:{not:null},event:{source:'manual'}}]};

/** Fila persistida na inscrição. Nunca repete um POST de resultado incerto. */
export async function processEventRefund(registrationId:string) {
 const now=new Date(),token=randomUUID();
 const claimed=await db.eventRegistration.updateMany({where:{id:registrationId,AND:[ELEGIVEL,{OR:[{refundLeaseUntil:null},{refundLeaseUntil:{lte:now}}]}]},data:{refundLockId:token,refundLeaseUntil:new Date(now.getTime()+600_000),refundAttempts:{increment:1}}});
 if(!claimed.count)return;
 const save=(data:Parameters<typeof db.eventRegistration.updateMany>[0]['data'])=>db.eventRegistration.updateMany({where:{id:registrationId,refundLockId:token},data});
 let postAttempted=false;
 try {
  const r=await db.eventRegistration.findUniqueOrThrow({where:{id:registrationId},include:{event:true}});
  if(!r.asaasPaymentId){
   await save({refundState:'sem_pagamento',refundCheckedAt:now,refundNextAttemptAt:new Date(now.getTime()+900_000)});return;
  }
  const payment=await asaasGetPaymentStatus(r.asaasPaymentId);
  if(payment.id!==r.asaasPaymentId||r.amount===null||Math.round(Number(r.amount)*100)!==Math.round(payment.value*100))throw Object.assign(Error('Pagamento divergente da inscrição.'),{code:'payment_mismatch'});
  const position=refundPosition(payment);
  if(position.done<Number(r.refundedAmount))throw Object.assign(Error('Histórico de estorno divergente.'),{code:'refund_mismatch'});
  const snapshot=JSON.parse(JSON.stringify(payment.refunds??[]));
  await save({refundCheckedAt:now,refundsSnapshot:snapshot,refundedAmount:position.done,...(position.done>Number(r.refundedAmount)?{refundedAt:now}:{}),...(['RECEIVED','CONFIRMED'].includes(payment.status)||position.done>0?{paidAt:r.paidAt??now,...(r.refundState!=='reembolsado'?{paid:!position.complete,paymentState:position.complete?'reembolsado':'pago'}:{})}:{})});
  if(position.complete){
   const first=r.refundState!=='reembolsado';
   await save({refundState:'reembolsado',refundedAt:position.done>Number(r.refundedAmount)?now:r.refundedAt??now,paymentState:'reembolsado',paid:false,refundError:position.splitPending?'Participante reembolsado; devolução do split ainda em processamento.':null,refundNextAttemptAt:position.splitPending?new Date(now.getTime()+900_000):null});
   if(first)await db.eventAudit.create({data:{eventId:r.eventId,actorId:'gateway',action:'reembolso_confirmado',changes:{registrationId:r.id,amount:position.done}}});
   return;
  }
  if(position.pending||payment.status==='REFUNDED'||payment.status==='REFUND_IN_PROGRESS'||r.refundSubmittedAt){
   await save({refundState:r.refundSubmittedAt&&!position.pending?'revisao':'acompanhando',refundNextAttemptAt:new Date(now.getTime()+900_000)});return;
  }
  if(payment.deleted){await save({refundState:'cobranca_cancelada',refundNextAttemptAt:null,refundError:null});return;}
  if(['PENDING','OVERDUE'].includes(payment.status)){
   const deleted=await asaasDeleteEventPayment(r.asaasPaymentId);
   if(!deleted.deleted)throw Error('Exclusão não confirmada.');
   await save({refundState:'cobranca_cancelada',refundNextAttemptAt:null,refundError:null});return;
  }
  if(!['RECEIVED','CONFIRMED'].includes(payment.status))throw Error('Cobrança ainda não elegível para devolução.');
  // Marca ANTES de enviar: queda ou timeout não poderá gerar outro estorno.
  const sending=await save({refundSubmittedAt:now,refundState:'processando',refundError:null});
  if(!sending.count)return;
  postAttempted=true;
  try {await asaasRefundEventPayment(r.asaasPaymentId,position.done>0?position.remaining:undefined,r.desistenciaEm?'Desistencia da inscricao: reembolso':undefined);}
  catch(error){
   const status=(error as {status?:number})?.status;
   // Uma rejeição inequívoca permite nova tentativa, sempre com consulta anterior.
   if(status&&[400,401,403,404,422].includes(status)){
    await save({refundSubmittedAt:null,refundState:'erro',refundError:refundErrorMessage(error),refundNextAttemptAt:new Date(now.getTime()+Math.min(360,15*2**Math.min(r.refundAttempts,5))*60_000)});return;
   }
   throw error;
  }
  await save({refundState:'acompanhando',refundNextAttemptAt:new Date(now.getTime()+900_000)});
  await db.eventAudit.create({data:{eventId:r.eventId,actorId:'gateway',action:'reembolso_solicitado_asaas',changes:{registrationId:r.id,amount:position.remaining}}});
 }catch(error){
  await save({refundState:postAttempted?'revisao':'erro',refundError:refundErrorMessage(error),refundNextAttemptAt:new Date(now.getTime()+900_000)});
 }finally{
  await save({refundLeaseUntil:null,refundLockId:null});
 }
}

export async function processEventRefundQueue(eventId?:string,limit=20) {
 const now=new Date();
 const rows=await db.eventRegistration.findMany({where:{...(eventId?{eventId}:{}),AND:[ELEGIVEL,{OR:[{refundNextAttemptAt:{lte:now}},{refundState:'pendente'},{refundState:'sem_pagamento',asaasPaymentId:{not:null}}]},{OR:[{refundLeaseUntil:null},{refundLeaseUntil:{lte:now}}]}]},select:{id:true},orderBy:[{refundNextAttemptAt:'asc'},{id:'asc'}],take:Math.min(Math.max(limit,1),50)});
 let consulted=0;const deadline=Date.now()+180_000;
 for(const r of rows){if(Date.now()>deadline)break;await processEventRefund(r.id);consulted++;}
 return {consultadas:consulted};
}
