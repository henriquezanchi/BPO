"use server";
import { db } from "@/lib/db";
import { requireEconomiaOuDirecao } from "@/lib/auth";
import { REFUND_LABELS } from "@/lib/event-refund-policy";
import { processEventRefund } from "@/lib/event-refunds";
import { revalidatePath } from "next/cache";

export async function getEventEconomyReport(schoolId:string,options:{from:string;to:string;cursor?:string}) {
 const actor=await requireEconomiaOuDirecao(schoolId);
 if(!actor.mercurioAtivo)throw Error('Acesso indisponível para cadastro inativo.');
 const valid=(v:string)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;};
 if(!valid(options.from)||!valid(options.to))throw Error('Informe datas válidas.');
 const from=new Date(options.from+'T00:00:00-03:00'),to=new Date(new Date(options.to+'T00:00:00-03:00').getTime()+86400000);
 if(to<=from||to.getTime()-from.getTime()>366*86400000)throw Error('Escolha um período de até um ano.');
 if(options.cursor&&(typeof options.cursor!=='string'||options.cursor.length>100))throw Error('Página inválida.');
 const range={gte:from,lt:to};
 const where={event:{schoolId,source:'manual'},OR:[{paidAt:range},{refundedAt:range},{refundSubmittedAt:range},{paidAt:null,createdAt:range}]};
 const [rows,school,totals]=await Promise.all([
  db.eventRegistration.findMany({where,include:{event:{select:{title:true,startsAt:true,status:true}},member:{select:{name:true,registrationNo:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,...(options.cursor?{cursor:{id:options.cursor},skip:1}:{})}),
  db.school.findUniqueOrThrow({where:{id:schoolId},select:{name:true,mercurioCaixaLancamento:true}}),
  db.eventRegistration.aggregate({where:{...where,paidAt:{not:null}},_sum:{amount:true,refundedAmount:true},_count:true}),
 ]);
 return {school:school.name,cashier:school.mercurioCaixaLancamento,totals:{received:Number(totals._sum.amount??0),refunded:Number(totals._sum.refundedAmount??0),count:totals._count},items:rows.slice(0,50).map(r=>({id:r.id,name:r.member.name,registrationNo:r.member.registrationNo,event:r.event.title,eventAt:r.event.startsAt.toISOString(),eventStatus:r.event.status,checkedIn:r.checkedIn,checkedInAt:r.checkedInAt?.toISOString()??null,selfReportedAttendance:r.selfReportedAttendance,registeredAt:r.createdAt.toISOString(),receivedAt:r.paidAt?.toISOString()??null,amount:r.amount===null?null:Number(r.amount),paid:r.paid,paymentState:r.paymentState,paymentId:r.asaasPaymentId,refundState:r.refundState,refundLabel:REFUND_LABELS[r.refundState]??'Conferir',refundedAmount:Number(r.refundedAmount),refundedAt:r.refundedAt?.toISOString()??null,refundError:r.refundError,receipt:r.mercurioReceiptNo,recordedAt:r.mercurioRecordedAt?.toISOString()??null})),nextCursor:rows.length>50?rows[49].id:null};
}

/** Declaração humana, não confirmação de escrita automática no Mercúrio. */
export async function recordEventMercurioReceipt(schoolId:string,registrationId:string,receipt:string) {
 const actor=await requireEconomiaOuDirecao(schoolId);
 if(!actor.mercurioAtivo)throw Error('Acesso indisponível para cadastro inativo.');
 const value=receipt.trim();if(!value||value.length>100)throw Error('Informe o número do recibo ou referência do lançamento no Mercúrio.');
 await db.$transaction(async tx=>{
  const r=await tx.eventRegistration.findFirstOrThrow({where:{id:registrationId,event:{schoolId,source:'manual'}}});
  if(!r.paidAt||!r.asaasPaymentId)throw Error('Somente recebimentos confirmados podem ter referência de lançamento.');
  await tx.eventRegistration.update({where:{id:r.id},data:{mercurioReceiptNo:value,mercurioRecordedAt:new Date(),mercurioRecordedBy:actor.id,mercurioStatus:'informado_pela_economia'}});
  await tx.eventAudit.create({data:{eventId:r.eventId,actorId:actor.id,action:'lancamento_mercurio_informado',changes:{registrationId,receipt:value,previousReceipt:r.mercurioReceiptNo}}});
 });revalidatePath('/economia');revalidatePath('/diretor');
}
export async function reconcileEventRefund(schoolId:string,registrationId:string) {
 const actor=await requireEconomiaOuDirecao(schoolId);if(!actor.mercurioAtivo)throw Error('Acesso indisponível para cadastro inativo.');
 await db.eventRegistration.findFirstOrThrow({where:{id:registrationId,event:{schoolId,source:'manual',status:'cancelado',refundOnCancellation:true}}});
 await processEventRefund(registrationId);revalidatePath('/economia');
}
