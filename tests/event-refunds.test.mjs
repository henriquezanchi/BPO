import {mockModule} from './helpers/mock-module.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refundPosition} from '../src/lib/event-refund-policy.ts';
let row,payment,posts,deletes,audits,mode;
function reset(){row={id:'r',eventId:'e',asaasPaymentId:'pay',amount:50,paid:true,paymentState:'pago',refundState:'pendente',refundAttempts:0,refundSubmittedAt:null,refundLeaseUntil:null,refundLockId:null,refundedAt:null,refundedAmount:0,desistenciaEm:null,event:{schoolId:'s',source:'manual',status:'cancelado',refundOnCancellation:true}};payment={id:'pay',value:50,status:'RECEIVED',refunds:[]};posts=0;deletes=0;audits=[];mode='ok';}
// Reproduz a reserva de processEventRefund (where.AND = [ELEGIVEL, prazo livre]): só evento manual cancelado com
// devolução autorizada, ou desistência do próprio aluno (2026-10-22), e sem outra execução segurando a inscrição.
const elegivel=()=>row.event.source==='manual'&&(row.event.status==='cancelado'&&row.event.refundOnCancellation||row.desistenciaEm!==null);
const conta={apiKey:'subconta-key'};
const db={school:{findUnique:async args=>{assert.equal(args.where.id,'s');return {asaasSubaccountApiKey:conta.apiKey};}},eventRegistration:{
 updateMany:async({where,data})=>{
  if(where.AND&&(!elegivel()||row.refundLeaseUntil&&row.refundLeaseUntil>new Date()))return {count:0};
  if(where.refundLockId&&where.refundLockId!==row.refundLockId)return {count:0};
  for(const [key,value] of Object.entries(data))row[key]=value&&typeof value==='object'&&'increment'in value?row[key]+value.increment:value;
  return {count:1};
 },findUniqueOrThrow:async()=>structuredClone(row),findMany:async()=>[{id:'r'}]},eventAudit:{create:async(args)=>audits.push(args.data)}};
mockModule(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db}});
mockModule(new URL('../src/lib/asaas/client.ts',import.meta.url).href,{exports:{
 // Consulta, estorno e exclusão usam a subconta da filial que emitiu a cobrança (asaas/conta-escola.ts).
 asaasGetPaymentStatus:async(id,c)=>{assert.deepEqual(c,conta);return structuredClone(payment);},
 asaasRefundEventPayment:async(id,remaining,_descricao,c)=>{posts++;assert.equal(id,'pay');assert.deepEqual(c,conta);if(mode==='timeout')throw Error('timeout');if(mode==='balance')throw Object.assign(Error('private financial data'),{status:400});if(mode==='partial')assert.equal(remaining,30);return payment;},
 asaasDeleteEventPayment:async(id,c)=>{deletes++;assert.deepEqual(c,conta);return {id:'pay',deleted:true};},
}});
const {processEventRefund}=await import('../src/lib/event-refunds.ts');
test('devolução é conciliada por soma de DONE, sem contar cancelados, e acompanha splits',()=>{
 const p=refundPosition({value:50,refunds:[{status:'DONE',value:20},{status:'CANCELLED',value:30},{status:'PENDING',value:30}]});assert.equal(p.done,20);assert.equal(p.complete,false);assert.equal(p.pending,true);
 const full=refundPosition({value:50,refunds:[{status:'DONE',value:20},{status:'DONE',value:30,refundedSplits:[{id:'split',value:29,done:false}]}]});assert.equal(full.complete,true);assert.equal(full.splitPending,true);
 assert.throws(()=>refundPosition({value:50,refunds:[{status:'DONE',value:51}]}));
});
test('duas execuções concorrentes fazem um único POST e não declaram devolução pela aceitação',async()=>{
 reset();await Promise.all([processEventRefund('r'),processEventRefund('r')]);assert.equal(posts,1);assert.equal(row.paid,true);assert.equal(row.refundState,'acompanhando');assert.ok(row.refundSubmittedAt);assert.equal(row.refundLockId,null);
});
test('timeout de POST mantém marcador persistente e consulta posterior nunca repete devolução',async()=>{
 reset();mode='timeout';await processEventRefund('r');assert.equal(row.refundState,'revisao');assert.ok(row.refundSubmittedAt);assert.equal(row.refundError.includes('private'),false);
 mode='ok';await processEventRefund('r');assert.equal(posts,1);assert.equal(row.refundState,'revisao');
 payment.refunds=[{status:'DONE',value:50}];await processEventRefund('r');assert.equal(row.refundState,'reembolsado');assert.equal(row.paid,false);assert.equal(row.refundedAmount,50);assert.equal(row.paymentState,'reembolsado');assert.ok(row.refundedAt);
 await processEventRefund('r');assert.equal(posts,1);assert.equal(audits.filter(a=>a.action==='reembolso_confirmado').length,1);
});
test('rejeição 400 libera nova tentativa após consulta, sem expor corpo financeiro',async()=>{
 reset();mode='balance';await processEventRefund('r');assert.equal(row.refundSubmittedAt,null);assert.equal(row.refundState,'erro');assert.match(row.refundError,/saldo/);assert.equal(row.refundError.includes('private'),false);assert.ok(row.refundNextAttemptAt>new Date());
 mode='ok';await processEventRefund('r');assert.equal(posts,2);
});
test('estorno parcial anterior devolve apenas o saldo restante e pendência externa impede novo pedido',async()=>{
 reset();mode='partial';payment.refunds=[{status:'DONE',value:20}];await processEventRefund('r');assert.equal(posts,1);assert.equal(row.refundedAmount,20);
 reset();payment.refunds=[{status:'PENDING',value:50}];await processEventRefund('r');assert.equal(posts,0);assert.equal(row.refundState,'acompanhando');
});
test('cobrança não paga é excluída; inscrição sem cobrança ou divergente não gera reembolso',async()=>{
 reset();payment.status='PENDING';await processEventRefund('r');assert.equal(deletes,1);assert.equal(posts,0);assert.equal(row.refundState,'cobranca_cancelada');
 reset();row.asaasPaymentId=null;await processEventRefund('r');assert.equal(posts,0);assert.equal(row.refundState,'sem_pagamento');
 reset();payment.value=49;await processEventRefund('r');assert.equal(posts,0);assert.equal(row.refundState,'erro');
});
test('webhook de evento não cancelado ou sem autorização de reembolso não movimenta dinheiro',async()=>{
 reset();row.event.status='publicado';await processEventRefund('r');assert.equal(posts,0);assert.equal(deletes,0);
 reset();row.event.refundOnCancellation=false;await processEventRefund('r');assert.equal(posts,0);
 // Desistência do próprio aluno no prazo é a outra porta de reembolso, mesmo com o evento publicado.
 reset();row.event.status='publicado';row.desistenciaEm=new Date();await processEventRefund('r');assert.equal(posts,1);
});

test('recebimento sem webhook é recuperado da consulta e devolução conferida nunca é reduzida',async()=>{
 reset();row.paid=false;row.paidAt=null;await processEventRefund('r');assert.ok(row.paidAt);assert.equal(row.paid,true);
 reset();row.refundedAmount=20;payment.refunds=[];await processEventRefund('r');assert.equal(row.refundedAmount,20);assert.equal(posts,0);assert.match(row.refundError,/histórico/);
});
