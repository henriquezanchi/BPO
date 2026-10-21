"use server";

import {asaasCreatePixCharge,asaasFindOrCreateCustomer,asaasGetPaymentStatus,asaasGetPixQrCode} from '@/lib/asaas/client';
import {calcularSplitEscola} from '@/lib/asaas/split';
import {requireAuthenticatedMember,requireArea} from '@/lib/auth';
import {temAcessoVoluntario} from '@/lib/acesso-voluntario';
import {db} from '@/lib/db';
import {eventAudienceWhere,eventNoticePlan,validateInternalEvent,eventScopeWhere} from '@/lib/event-policy';
import {requireEventReception} from '@/lib/event-data';
import {EventEnrollmentError,eventPaymentFailure} from '@/lib/event-payment-errors';
import {confirmEventPayment} from '@/lib/event-payments';
import {processEventRefundQueue} from '@/lib/event-refunds';
import {revalidatePath} from 'next/cache';

export interface InternalEventInput {title:string;startsAt:string;endsAt:string;price:number;audience?:string;publicos?:string[];abertoA?:string;abertoValores?:string[];description:string;location:string;capacity?:number|null;registrationClosesAt?:string|null;participantInstructions?:string;contactInfo?:string;posterPath?:string|null}
function refresh(eventId?:string){revalidatePath('/','layout');revalidatePath('/portal');if(eventId)revalidatePath(`/eventos/${eventId}/recepcao`);}
export async function salvarEvento(schoolId:string,input:InternalEventInput,id?:string,revision?:number) {
 try {
  const actor=await requireArea(schoolId, "eventos");if(!actor.mercurioAtivo)throw Error('Cadastro inativo.');
  const data=validateInternalEvent(input);
  if(data.posterPath&&(!data.posterPath.startsWith(`${schoolId}/event-posters/`)||data.posterPath.includes("..")||!/^[-a-zA-Z0-9/_.]+$/.test(data.posterPath)))throw Error("Cartaz inválido para esta escola.");
  await db.$transaction(async tx=>{
   let eventId=id;
   if(id){
    if(!Number.isSafeInteger(revision)||revision!<0)throw Error('Atualize o evento antes de editar.');
    const current=await tx.event.findFirstOrThrow({where:{id,schoolId,source:'manual',status:'publicado'}});
    if(current.startsAt<=new Date())throw Error('Eventos já iniciados preservam seu histórico e não podem ser editados.');
    if(data.capacity!==null&&data.capacity<await tx.eventRegistration.count({where:{eventId:id}}))throw Error("O limite não pode ser menor que o número de inscrições já reservadas.");
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
export async function excluirEvento(schoolId:string,eventId:string,reembolsar=false){
 if(typeof reembolsar!=='boolean')throw Error('Opção de reembolso inválida.');
 const actor=await requireArea(schoolId, "eventos");if(!actor.mercurioAtivo)throw Error('Cadastro inativo.');
 await db.$transaction(async tx=>{
  const changed=await tx.event.updateMany({where:{id:eventId,schoolId,source:'manual',OR:[{status:'publicado'},...(reembolsar?[{status:'cancelado',refundOnCancellation:false}]:[])]},data:{status:'cancelado',...(reembolsar?{refundOnCancellation:true}:{}),revision:{increment:1}}});
  if(!changed.count)throw Error('Evento indisponível para cancelamento.');
  await tx.eventNotice.updateMany({where:{registration:{eventId},status:'aguardando_canal'},data:{status:'cancelado'}});
  const registrations=await tx.eventRegistration.findMany({where:{eventId},select:{id:true}});
  for(const r of registrations)await tx.eventNotice.upsert({where:{registrationId_kind:{registrationId:r.id,kind:'cancelamento'}},create:{registrationId:r.id,kind:'cancelamento',dueAt:new Date()},update:{status:'aguardando_canal',dueAt:new Date()}});
  await tx.eventAudit.create({data:{eventId,actorId:actor.id,action:'cancelado',changes:{reembolsarInscricoes:reembolsar}}});
  if(reembolsar)await tx.eventRegistration.updateMany({where:{eventId,refundState:'nao_solicitado'},data:{refundState:'pendente',refundNextAttemptAt:new Date()}});
 });
 if(reembolsar)await processEventRefundQueue(eventId,1);
 refresh(eventId);
}
export async function definirRecepcaoEvento(schoolId:string,eventId:string,memberId:string,add:boolean){
 const actor=await requireArea(schoolId, "eventos");if(!actor.mercurioAtivo)throw Error('Cadastro inativo.');
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
async function enrollEvent(memberId:string,eventId:string,cpf?:string){
 const member=await requireAuthenticatedMember(memberId);
 if(member.isJanos)throw new EventEnrollmentError('Seu perfil permite somente consulta.');
 const volunteer=await temAcessoVoluntario(member);
 // Filial da pessoa ou evento de outra filial aberto a ela (abertoA — 2026-10-19).
 const eligible={id:eventId,source:'manual',status:'publicado',startsAt:{gt:new Date()},AND:[eventAudienceWhere(member,volunteer),eventScopeWhere(member.school)]};
 const event=await db.event.findFirst({where:eligible});
 if(!event)throw new EventEnrollmentError('Evento indisponível para seu perfil ou inscrições encerradas.');
 const price=Number(event.price);
 if(price>0&&(!cpf||!/^[0-9]{11}$/.test(cpf)))throw new EventEnrollmentError('Informe o CPF com 11 números.');
 const school=await db.school.findUniqueOrThrow({where:{id:event.schoolId!}});
 if(price>0&&!school.asaasWalletId)throw new EventEnrollmentError('A escola ainda precisa configurar o recebimento e o split antes de liberar inscrições pagas.');
 const registration=await db.$transaction(async tx=>{
  const lock=await tx.event.updateMany({where:{...eligible,revision:event.revision},data:{revision:{increment:1}}});
  if(!lock.count)throw new EventEnrollmentError('O evento mudou. Atualize a Agenda antes de se inscrever.');
  if(event.capacity!==null&&event.capacity!==undefined||event.registrationClosesAt){
   const existing=await tx.eventRegistration.findUnique({where:{eventId_memberId:{eventId,memberId}},select:{id:true}});
   if(!existing){
    if(event.registrationClosesAt&&event.registrationClosesAt<=new Date())throw new EventEnrollmentError('As inscrições deste evento foram encerradas.');
    if(event.capacity!==null&&event.capacity!==undefined&&await tx.eventRegistration.count({where:{eventId}})>=event.capacity)throw new EventEnrollmentError('Todas as vagas deste evento já foram reservadas.');
   }
  }
  return tx.eventRegistration.upsert({where:{eventId_memberId:{eventId,memberId}},create:{eventId,memberId,amount:price,paid:price===0,paymentState:price===0?'gratuito':'novo'},update:{}});
 });
 if(price===0||registration.paid){
  if(event.status==='publicado')await db.eventNotice.createMany({data:eventNoticePlan(event.startsAt,event.endsAt??event.startsAt).map(n=>({...n,registrationId:registration.id})),skipDuplicates:true});
  refresh(eventId);return {jaInscrito:true as const,pago:true as const,registrationId:registration.id};
 }
 if(registration.pixPayload)return {jaInscrito:true as const,pago:false as const,registrationId:registration.id,pixPayload:registration.pixPayload,pixQrCodeBase64:registration.pixQrCodeBase64!};
 if(registration.asaasPaymentId){
  try{
  const qr=await asaasGetPixQrCode(registration.asaasPaymentId);
  await db.eventRegistration.update({where:{id:registration.id},data:{pixPayload:qr.payload,pixQrCodeBase64:qr.encodedImage}});
  return {jaInscrito:true as const,pago:false as const,registrationId:registration.id,pixPayload:qr.payload,pixQrCodeBase64:qr.encodedImage};
  }catch{throw new EventEnrollmentError('O PIX desta inscrição já existe, mas não foi possível recuperar o QR Code. Tente novamente mais tarde; não é necessário criar outra cobrança.');}
 }
 // Pré-condições de leitura antes de reservar a cobrança: falha aqui não emite PIX.
 let split:Awaited<ReturnType<typeof calcularSplitEscola>>|null=null;
 if(price>0){
  if(!process.env.ASAAS_API_KEY)throw new EventEnrollmentError(eventPaymentFailure(new Error('ASAAS_API_KEY não configurado.')).message);
  try{split=await calcularSplitEscola(price,school.asaasWalletId!);}catch(error){throw new EventEnrollmentError(eventPaymentFailure(error).message);}
  if(!split.fixedValue||split.fixedValue<=0)throw new EventEnrollmentError('A contribuição não cobre os custos de processamento. Peça conferência à Economia.');
 }
 const claimed=await db.eventRegistration.updateMany({where:{id:registration.id,paymentState:'novo',asaasPaymentId:null},data:{paymentState:'criando'}});
 if(!claimed.count)throw new EventEnrollmentError('Sua cobrança está sendo preparada ou precisa de conferência pela Economia. Não gere outra cobrança.');
 let stage:'cliente'|'criacao_cobranca'|'qrcode'='cliente';
 try {
  const customer=await asaasFindOrCreateCustomer(member.name,cpf!,member.email??undefined);
  await db.eventRegistration.update({where:{id:registration.id},data:{asaasCustomerId:customer.id}});
  const dueDate=new Date(Math.min(Date.now()+2*86400000,event.startsAt.getTime())).toISOString().slice(0,10);
  stage='criacao_cobranca';
  const payment=await asaasCreatePixCharge(customer.id,price,`Inscrição: ${event.title} — ${member.name}`,dueDate,[split!]);
  // Persistir o ID antes de buscar QR: falha na consulta não cria cobrança duplicada.
  await db.eventRegistration.update({where:{id:registration.id},data:{asaasCustomerId:customer.id,asaasPaymentId:payment.id,paymentState:'pendente'}});
  stage='qrcode';
  const qr=await asaasGetPixQrCode(payment.id);
  await db.eventRegistration.update({where:{id:registration.id},data:{pixPayload:qr.payload,pixQrCodeBase64:qr.encodedImage}});
  refresh(eventId);return {jaInscrito:false as const,pago:false as const,registrationId:registration.id,pixPayload:qr.payload,pixQrCodeBase64:qr.encodedImage};
 }catch(error){
  const failure=eventPaymentFailure(error);
  // Falha antes do POST não pode ter criado cobrança. Depois do POST, só uma
  // rejeição HTTP inequívoca permite nova tentativa; timeout permanece em revisão.
  const rejected=failure.status!==null&&failure.status>=400&&failure.status<500&&failure.status!==408&&failure.status!==409;
  const safeToRetry=stage==='cliente'||(stage==='criacao_cobranca'&&rejected);
  await db.$transaction(async tx=>{
   await tx.eventRegistration.updateMany({where:{id:registration.id,asaasPaymentId:null},data:{paymentState:safeToRetry?'novo':'revisao'}});
   await tx.eventAudit.create({data:{eventId,actorId:memberId,action:'falha_pagamento',changes:{registrationId:registration.id,stage,code:failure.code,httpStatus:failure.status,safeToRetry}}});
  });
  throw new EventEnrollmentError(stage==='qrcode'?'A cobrança já foi criada, mas o QR Code não carregou. Tente abrir a inscrição novamente para recuperar o mesmo PIX.':safeToRetry?failure.message:'O pedido de cobrança precisa de conferência pela Economia antes de outra tentativa. Sua inscrição foi preservada para evitar pagamento duplicado.');
 }
}
export async function inscreverEmEvento(memberId:string,eventId:string,cpf?:string){
 try{return {ok:true as const,...await enrollEvent(memberId,eventId,cpf)};}
 catch(error){
  if(error instanceof EventEnrollmentError)return {ok:false as const,error:error.message};
  return {ok:false as const,error:'Não foi possível concluir a inscrição. Atualize a Agenda e confira se seu acesso continua ativo.'};
 }
}
export async function checkStatusInscricaoEvento(memberId:string,registrationId:string){
 await requireAuthenticatedMember(memberId);
 const r=await db.eventRegistration.findFirstOrThrow({where:{id:registrationId,memberId},include:{event:true}});
 if(r.event.status==='cancelado')return {status:'cancelado' as const};
 if(r.paid)return {status:'pago' as const};
 if(!r.asaasPaymentId)return {status:'pendente' as const};
 const payment=await asaasGetPaymentStatus(r.asaasPaymentId);
 if(['RECEIVED','CONFIRMED'].includes(payment.status)){
  if(r.amount!==null&&Math.round(payment.value*100)!==Math.round(Number(r.amount)*100))throw Error('Valor recebido divergente. Procure a Economia.');
  await confirmEventPayment(r.id);refresh(r.eventId);return {status:'pago' as const};
 }
 return {status:'pendente' as const};
}

export async function definirRecepcaoEmLote(schoolId:string,eventId:string,memberIds:string[]){
 try{
  const actor=await requireArea(schoolId, "eventos");if(!actor.mercurioAtivo)throw Error('Cadastro inativo.');
  const ids=[...new Set(memberIds)];
  if(!ids.length||ids.length>200||ids.some(id=>typeof id!=="string"||id.length>100))throw Error('Selecione entre 1 e 200 pessoas.');
  await db.event.findFirstOrThrow({where:{id:eventId,schoolId,source:'manual',status:'publicado'}});
  const members=await db.member.findMany({where:{id:{in:ids},schoolId,mercurioAtivo:true}});
  if(members.length!==ids.length)throw Error('Todas as pessoas precisam estar ativas nesta escola.');
  if((await Promise.all(members.map(member=>temAcessoVoluntario(member)))).some(access=>!access))throw Error('Todas as pessoas precisam ter acesso de voluntário liberado.');
  await db.$transaction(async tx=>{
   await tx.eventReception.createMany({data:ids.map(memberId=>({eventId,memberId})),skipDuplicates:true});
   await tx.eventAudit.create({data:{eventId,actorId:actor.id,action:'recepcao_designada_em_lote',changes:{memberIds:ids}}});
  });refresh(eventId);return {ok:true};
 }catch{return {ok:false,error:'Não foi possível liberar a equipe. Selecione voluntários ativos e com acesso liberado desta escola, em um evento publicado.'};}
}
