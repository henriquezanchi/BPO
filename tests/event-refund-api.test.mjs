import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import {asaasRefundEventPayment,asaasDeleteEventPayment} from '../src/lib/asaas/client.ts';
test('API de devolução usa cobrança original, omite valor no estorno integral e não envia split arbitrário',async()=>{
 process.env.ASAAS_API_KEY='test-only';const calls=[];
 const mocked=mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return Response.json({id:'pay',status:'REFUND_IN_PROGRESS',deleted:true});});
 try{
  await asaasRefundEventPayment('pay');let c=calls.at(-1);assert.equal(c.options.method,'POST');assert.ok(c.url.endsWith('/payments/pay/refund'));assert.equal(c.options.headers.access_token,'test-only');assert.equal(JSON.parse(c.options.body).value,undefined);assert.equal(JSON.parse(c.options.body).splitRefunds,undefined);
  await asaasRefundEventPayment('pay',30);assert.equal(JSON.parse(calls.at(-1).options.body).value,30);
  assert.equal((await asaasDeleteEventPayment('pay')).deleted,true);assert.equal(calls.at(-1).options.method,'DELETE');
 }finally{mocked.mock.restore();}
});
