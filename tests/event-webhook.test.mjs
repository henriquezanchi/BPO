import {test,mock} from 'node:test';import assert from 'node:assert/strict';
let confirmed=0,value=50;
mock.module(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{paymentCharge:{findUnique:async()=>null},matriculaOnline:{findUnique:async()=>null},eventRegistration:{findUnique:async()=>({id:'registration',amount:50})}}}});
mock.module(new URL('../src/lib/asaas/client.ts',import.meta.url).href,{exports:{asaasGetPaymentStatus:async()=>({status:'CONFIRMED',value})}});
mock.module(new URL('../src/lib/event-payments.ts',import.meta.url).href,{exports:{confirmEventPayment:async()=>{confirmed++;}}});
mock.module(new URL('../src/lib/asaas/confirm-payment.ts',import.meta.url).href,{exports:{confirmarPagamento:async()=>{throw Error('unexpected contribution payment');}}});
mock.module(new URL('../src/lib/event-refunds.ts',import.meta.url).href,{exports:{processEventRefund:async()=>{}}});
const {POST}=await import('../src/app/api/webhooks/asaas/route.ts');
function request(token){return new Request('http://localhost/api/webhooks/asaas',{method:'POST',headers:{'content-type':'application/json',...(token?{'asaas-access-token':token}:{})},body:JSON.stringify({event:'PAYMENT_CONFIRMED',payment:{id:'payment'}})});}
test('webhook sem configuração ou sem autenticação nunca confirma inscrição',async()=>{
 delete process.env.ASAAS_WEBHOOK_TOKEN;assert.equal((await POST(request())).status,503);
 process.env.ASAAS_WEBHOOK_TOKEN='test-only';assert.equal((await POST(request('wrong'))).status,401);assert.equal(confirmed,0);
});
test('confirmação exige valor real esperado no gateway',async()=>{
 value=49;assert.equal((await POST(request('test-only'))).status,409);assert.equal(confirmed,0);
 value=50;assert.equal((await POST(request('test-only'))).status,200);assert.equal(confirmed,1);
});
