"use server";

import {asaasCreatePixCharge,asaasFindOrCreateCustomer,asaasGetPaymentStatus,asaasGetPixQrCode} from '@/lib/asaas/client';
import {calcularSplitEscola} from '@/lib/asaas/split';
import {requireAuthenticatedMember,requireDirector} from '@/lib/auth';
import {temAcessoVoluntario} from '@/lib/acesso-voluntario';
import {db} from '@/lib/db';
import {eventAudienceWhere,eventNoticePlan,validateInternalEvent} from '@/lib/event-policy';
import {requireEventReception} from '@/lib/event-data';
import {confirmEventPayment} from '@/lib/event-payments';
import {revalidatePath} from 'next/cache';

export interface InternalEventInput {title:string;startsAt:string;endsAt:string;price:number;audience:string;description:string;location:string}
function refresh(eventId?:string){revalidatePath('/diretor');revalidatePath('/portal');if(eventId)revalidatePath(`/eventos/${eventId}/recepcao`);}
export async function salvarEvento(schoolId:string,input:InternalEventInput,id?:string,revision?:number) {
 try {
  const actor=await requireDirector(schoolId);if(!actor.mercurioAtivo)throw Error('Cadastro inativo.');
  const data=validateInternalEvent(input);
  await db.$transaction(async tx=>{
   let eventId=id;
   if(id){
    if(!Number.isSafeInteger(revision)||revision!<0)throw Error('Atualize o evento antes de editar.');
    const current=await tx.event.findFirstOrThrow({where:{id,schoolId,source:'manual',status:'publicado'}});
    if(current.startsAt<=new Date())throw Error('Eventos já iniciados preservam seu histórico e não podem ser editados.');
    if(Number(current.price)!==data.price&&await tx.eventRegistration.count({where:{eventId:id}}))throw Error('O valor não pode mudar depois da primeira inscrição.');
    const changed=await tx.event.updateMany({where:{id,schoolId,source:'manual',revision,status:'publicado'},data:{...data,revision:{increment:1}}});
    if(!changed.count)throw Error('O evento mudou em outra sessão. Atualize antes de editar.');
    await tx.eventNotice.updateMany({where:{registration:{eventId:id},status:'aguardando_canal'},data:{status:'cancelado'}});
    const registrations=await tx.eventRegistration.findMany({where:{eventId:id,paid:true},select:{id:true}});
    for(const r of registrations)for(const n of eventNoticePlan(data.startsAt,data.endsAt).filter(n=>n.kind!=='inscricao'))await tx.eventNotice.upsert({where:{registrationId_kind:{registrationId:r.id,kind:n.kind}},create:{...n,registrationId:r.id},update:{dueAt:n.dueAt,status:'aguardando_canal'}});
   }else eventId=(await tx.event.create({data:{schoolId,...data}})).id;
   await tx.eventAudit.create({data:{eventId:eventId!,actorId:actor.id,action:id?'editado':'criado',changes:JSON.parse(JSON.stringify(data))}});
  });refresh(id);return {ok:true};
 }catch(e){return {ok:false,error:e instanceof Error&&!e.message.includes('prisma')?e.message:'Não foi possível salvar o evento.'};}
}
// Compatibilidade com a tela anterior; novas telas exigem também término e público.
export async function criarEvento(schoolId:string,title:string,startsAt:string,price:number){return salvarEvento(schoolId,{title,startsAt,endsAt:new Date(new Date(startsAt).getTime()+7200000).toISOString(),price,audience:'todos_ativos',description:'',location:''});}
export async function excluirEvento(schoolId:string,eventId:string){
 const actor=await requireDirector(schoolId);if(!actor.mercurioAtivo)throw Error('Cadastro inativo.');
 await db.$transaction(async tx=>{
  const changed=await tx.event.updateMany({where:{id:eventId,schoolId,source:'manual',status:'publicado'},data:{status:'cancelado',revision:{increment:1}}});
  if(!changed.count)throw Error('Evento indisponível para cancelamento.');
  await tx.eventNotice.updateMany({where:{registration:{eventId},status:'aguardando_canal'},data:{status:'cancelado'}});
  const registrations=await tx.eventRegistration.findMany({where:{eventId},select:{id:true}});
  for(const r of registrations)await tx.eventNotice.upsert({where:{registrationId_kind:{registrationId:r.id,kind:'cancelamento'}},create:{registrationId:r.id,kind:'cancelamento',dueAt:new Date()},update:{status:'aguardando_canal',dueAt:new Date()}});
  await tx.eventAudit.create({data:{eventId,actorId:actor.id,action:'cancelado',changes:{refunds:'Conferir pagamentos e estornos com a Economia; nenhum estorno automático.'}}});
 });refresh(eventId);
}
export async function definirRecepcaoEvento(schoolId:string,eventId:string,memberId:string,add:boolean){
 const actor=await requireDirector(schoolId);if(!actor.mercurioAtivo)throw Error('Cadastro inativo.');
 await db.event.findFirstOrThrow({where:{id:eventId,schoolId,source:'manual'}});
 if(add){const member=await db.member.findFirstOrThrow({where:{id:memberId,schoolId,mercurioAtivo:true}});if(!await temAcessoVoluntario(member))throw Error('A pessoa precisa ter acesso de voluntário liberado.');}
 await db.$transaction(async tx=>{
  if(add)await tx.eventReception.upsert({where:{eventId_memberId:{eventId,memberId}},create:{eventId,memberId},update:{}});
  else await tx.eventReception.deleteMany({where:{eventId,memberId}});
  await tx.eventAudit.create({data:{eventId,actorId:actor.id,action:add?'recepcao_designada':'recepcao_removida',changes:{memberId}}});
 });refresh(eventId);
}
export async function marcarPresencaEvento(_schoolId:string,registrationId:string,presente:boolean){
 const registration=await db.eventRegistration.findUniqueOrThrow({where:{id:registrationId},include:{event:true}});
 const {actor}=await requireEventReception(registration.eventId);
 if(registration.event.status!=='publicado')throw Error('Evento cancelado.');
 if(new Date()<new Date(registration.event.startsAt.getTime()-7200000))throw Error('A recepção abre duas horas antes do evento.');
 if(presente&&!registration.paid)throw Error('Inscrição ainda pendente de pagamento. Confirme com a Economia.');
 await db.$transaction(async tx=>{
  await tx.eventRegistration.update({where:{id:registrationId},data:{checkedIn:presente,checkedInAt:presente?new Date():null,checkedInBy:actor.id,mercurioStatus:'aguardando_integracao'}});
  await tx.eventAudit.create({data:{eventId:registration.eventId,actorId:actor.id,action:presente?'presenca_confirmada':'presenca_corrigida',changes:{registrationId,previous:registration.checkedIn,current:presente}}});
 });refresh(registration.eventId);
}
export async function declararComparecimento(memberId:string,registrationId:string,presente:boolean){
 await requireAuthenticatedMember(memberId);
 const r=await db.eventRegistration.findFirstOrThrow({where:{id:registrationId,memberId},include:{event:true}});
 if(r.event.status!=='publicado'||(r.event.endsAt??r.event.startsAt)>new Date())throw Error('Disponível após o encerramento do evento.');
 await db.$transaction(async tx=>{
  await tx.eventRegistration.update({where:{id:r.id},data:{selfReportedAttendance:presente?'sim':'nao',selfReportedAt:new Date()}});
  await tx.eventAudit.create({data:{eventId:r.eventId,actorId:memberId,action:'comparecimento_declarado',changes:{registrationId,presente}}});
 });refresh(r.eventId);
}
export async function inscreverEmEvento(memberId:string,eventId:string,cpf?:string){
 const member=await requireAuthenticatedMember(memberId);
 if(member.isJanos)throw Error('Seu perfil permite somente consulta.');
 const volunteer=await temAcessoVoluntario(member);
 const eligible={id:eventId,schoolId:member.schoolId,source:'manual',status:'publicado',startsAt:{gt:new Date()},AND:[eventAudienceWhere(member,volunteer)]};
 const event=await db.event.findFirst({where:eligible});
 if(!event)throw Error('Evento indisponível para seu perfil ou inscrições encerradas.');
 const price=Number(event.price);
 if(price>0&&(!cpf||!/^[0-9]{11}$/.test(cpf)))throw Error('Informe o CPF com 11 números.');
 const school=await db.school.findUniqueOrThrow({where:{id:event.schoolId!}});
 if(price>0&&!school.asaasWalletId)throw Error('A escola ainda precisa configurar o recebimento e o split antes de liberar inscrições pagas.');
 const registration=await db.$transaction(async tx=>{
  const lock=await tx.event.updateMany({where:{...eligible,revision:event.revision},data:{revision:{increment:1}}});
  if(!lock.count)throw Error('O evento mudou. Atualize a Agenda antes de se inscrever.');
  return tx.eventRegistration.upsert({where:{eventId_memberId:{eventId,memberId}},create:{eventId,memberId,amount:price,paid:price===0,paymentState:price===0?'gratuito':'novo'},update:{}});
 });
 if(price===0||registration.paid){
  if(event.status==='publicado')await db.eventNotice.createMany({data:eventNoticePlan(event.startsAt,event.endsAt??event.startsAt).map(n=>({...n,registrationId:registration.id})),skipDuplicates:true});
  refresh(eventId);return {jaInscrito:true as const,pago:true as const,registrationId:registration.id};
 }
 if(registration.pixPayload)return {jaInscrito:true as const,pago:false as const,registrationId:registration.id,pixPayload:registration.pixPayload,pixQrCodeBase64:registration.pixQrCodeBase64!};
 if(registration.asaasPaymentId){
  const qr=await asaasGetPixQrCode(registration.asaasPaymentId);
  await db.eventRegistration.update({where:{id:registration.id},data:{pixPayload:qr.payload,pixQrCodeBase64:qr.encodedImage}});
  return {jaInscrito:true as const,pago:false as const,registrationId:registration.id,pixPayload:qr.payload,pixQrCodeBase64:qr.encodedImage};
 }
 const claimed=await db.eventRegistration.updateMany({where:{id:registration.id,paymentState:'novo',asaasPaymentId:null},data:{paymentState:'criando'}});
 if(!claimed.count)throw Error('Sua cobrança está sendo preparada ou precisa de conferência pela Economia. Não gere outra cobrança.');
 try {
  const customer=await asaasFindOrCreateCustomer(member.name,cpf!,member.email??undefined);
  const split=await calcularSplitEscola(price,school.asaasWalletId!);
  if(!split.fixedValue||split.fixedValue<=0)throw Error('A contribuição não cobre os custos de processamento.');
  const dueDate=new Date(Math.min(Date.now()+2*86400000,event.startsAt.getTime())).toISOString().slice(0,10);
  const payment=await asaasCreatePixCharge(customer.id,price,`Inscrição: ${event.title} — ${member.name}`,dueDate,[split]);
  // Persistir o ID antes de buscar QR: falha na consulta não cria cobrança duplicada.
  await db.eventRegistration.update({where:{id:registration.id},data:{asaasCustomerId:customer.id,asaasPaymentId:payment.id,paymentState:'pendente'}});
  const qr=await asaasGetPixQrCode(payment.id);
  await db.eventRegistration.update({where:{id:registration.id},data:{pixPayload:qr.payload,pixQrCodeBase64:qr.encodedImage}});
  refresh(eventId);return {jaInscrito:false as const,pago:false as const,registrationId:registration.id,pixPayload:qr.payload,pixQrCodeBase64:qr.encodedImage};
 }catch{
  await db.eventRegistration.updateMany({where:{id:registration.id,asaasPaymentId:null},data:{paymentState:'revisao'}});
  throw Error('Não foi possível concluir o PIX. A inscrição foi preservada; consulte novamente ou peça conferência à Economia.');
 }
}
export async function checkStatusInscricaoEvento(memberId:string,registrationId:string){
 await requireAuthenticatedMember(memberId);
 const r=await db.eventRegistration.findFirstOrThrow({where:{id:registrationId,memberId}});
 if(r.paid)return {status:'pago' as const};
 if(!r.asaasPaymentId)return {status:'pendente' as const};
 const payment=await asaasGetPaymentStatus(r.asaasPaymentId);
 if(['RECEIVED','CONFIRMED'].includes(payment.status)){
  if(r.amount!==null&&Math.round(payment.value*100)!==Math.round(Number(r.amount)*100))throw Error('Valor recebido divergente. Procure a Economia.');
  await confirmEventPayment(r.id);refresh(r.eventId);return {status:'pago' as const};
 }
 return {status:'pendente' as const};
}
