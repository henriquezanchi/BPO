import {mockModule} from './helpers/mock-module.mjs';
import assert from 'node:assert/strict';import {test} from 'node:test';
let permitido=true,ativo=true;const consultas=[];
mockModule(new URL('../src/lib/auth.ts',import.meta.url).href,{exports:{requireEconomiaOuDirecao:async school=>{if(!permitido||school!=='escola')throw new Error('Sem permissão');return {mercurioAtivo:ativo};}}});
mockModule(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{paymentCharge:{findMany:async query=>{consultas.push(query);return Array.from({length:51},(_,i)=>({id:'c'+i,memberId:'m'+i,member:{name:'Pessoa teste'},referenceYear:2026,referenceMonth:9,amount:'110.00',billingType:'PIX',status:'pago',paidAt:new Date('2026-10-18')}));}},mercurioSyncTask:{findMany:async query=>{consultas.push(query);return [{payload:{chargeId:'c0'},status:'falhou',attempts:1}];}}}}});
const {getPaymentReview}=await import('../src/lib/actions/payment-review-actions.ts');
test('consulta exige permissão de economia na escola e cadastro ativo antes de ler cobranças',async()=>{
 permitido=false;await assert.rejects(()=>getPaymentReview('escola'));permitido=true;await assert.rejects(()=>getPaymentReview('outra'));ativo=false;await assert.rejects(()=>getPaymentReview('escola'));ativo=true;assert.equal(consultas.length,0);
});
test('pagina 50 registros, restringe escola nos dois acessos e serializa só campos úteis',async()=>{
 const page=await getPaymentReview('escola');assert.equal(page.items.length,50);assert.equal(page.nextCursor,'c49');assert.equal(page.items[0].amount,110);assert.equal(page.items[0].stage.key,'conferir');
 assert.ok(consultas.every(q=>q.where.member.schoolId==='escola'));assert.equal(consultas[0].take,51);assert.deepEqual(consultas[0].orderBy,[{createdAt:'desc'},{id:'desc'}]);assert.equal('asaasPaymentId' in page.items[0],false);
 await getPaymentReview('escola',{cursor:'c49',status:'pendente'});assert.deepEqual(consultas[2].cursor,{id:'c49'});assert.equal(consultas[2].where.status,'pendente');
});
