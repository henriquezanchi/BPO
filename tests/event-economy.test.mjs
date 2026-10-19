import {test,mock} from 'node:test';import assert from 'node:assert/strict';
let allowed=true,active=true,query,writes=[];
const row={id:'r',eventId:'e',event:{title:'Palestra',startsAt:new Date('2026-10-20T22:00Z'),status:'cancelado'},member:{name:'Aluno teste',registrationNo:42},createdAt:new Date('2026-10-01T12:00Z'),paidAt:new Date('2026-10-02T12:00Z'),amount:50,paid:false,paymentState:'reembolsado',asaasPaymentId:'pay',refundState:'reembolsado',refundedAmount:50,refundedAt:new Date('2026-10-19T12:00Z'),refundError:null,mercurioReceiptNo:null,mercurioRecordedAt:null,checkedIn:false,checkedInAt:null,selfReportedAttendance:'sim'};
const tx={eventRegistration:{findFirstOrThrow:async({where})=>{assert.equal(where.event.schoolId,'s');return row;},update:async a=>writes.push(a)},eventAudit:{create:async a=>writes.push(a)}};
mock.module(new URL('../src/lib/auth.ts',import.meta.url).href,{exports:{requireEconomiaOuDirecao:async id=>{assert.equal(id,'s');if(!allowed)throw Error('Sem permissão');return {id:'actor',mercurioAtivo:active};}}});
mock.module(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{$transaction:async fn=>fn(tx),eventRegistration:{findMany:async args=>{query=args;return [row];},aggregate:async()=>({_sum:{amount:50,refundedAmount:50},_count:1})},school:{findUniqueOrThrow:async()=>({name:'Escola teste',mercurioCaixaLancamento:'Banco'})}}}});
mock.module(new URL('../src/lib/event-refunds.ts',import.meta.url).href,{exports:{processEventRefund:async()=>{}}});
mock.module('next/cache',{exports:{revalidatePath:()=>{}}});
const{getEventEconomyReport,recordEventMercurioReceipt}=await import('../src/lib/actions/event-economy-actions.ts');
test('relatório da Economia limita escola e datas, separa presença declarada de conferida e mostra original/devolução',async()=>{
 const r=await getEventEconomyReport('s',{from:'2026-10-01',to:'2026-10-31'});assert.equal(query.where.event.schoolId,'s');assert.equal(query.take,51);assert.equal(query.where.OR[0].paidAt.gte.toISOString(),'2026-10-01T03:00:00.000Z');assert.equal(query.where.OR[0].paidAt.lt.toISOString(),'2026-11-01T03:00:00.000Z');assert.equal(r.items[0].amount,50);assert.equal(r.items[0].refundedAmount,50);assert.equal(r.items[0].checkedIn,false);assert.equal(r.items[0].selfReportedAttendance,'sim');
 await assert.rejects(()=>getEventEconomyReport('s',{from:'2026-99-01',to:'2026-10-31'}),/datas/);await assert.rejects(()=>getEventEconomyReport('s',{from:'2020-01-01',to:'2026-10-31'}),/um ano/);
 allowed=false;await assert.rejects(()=>getEventEconomyReport('s',{from:'2026-10-01',to:'2026-10-31'}),/permissão/);allowed=true;active=false;await assert.rejects(()=>recordEventMercurioReceipt('s','r','12'),/inativo/);active=true;
});
test('referência manual exige recebimento, preserva auditoria e não escreve no Mercúrio',async()=>{
 await assert.rejects(()=>recordEventMercurioReceipt('s','r',''),/número/);
 await recordEventMercurioReceipt('s','r','123');assert.equal(writes[0].data.mercurioStatus,'informado_pela_economia');assert.equal(writes[1].data.action,'lancamento_mercurio_informado');assert.equal(writes[1].data.changes.receipt,'123');
 row.paidAt=null;await assert.rejects(()=>recordEventMercurioReceipt('s','r','321'),/confirmados/);
});
