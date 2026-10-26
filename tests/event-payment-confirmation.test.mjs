import {mockModule} from './helpers/mock-module.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';
let paid=false,audits=0,notices=0;
const tx={eventRegistration:{updateMany:async()=>{if(paid)return {count:0};paid=true;return {count:1};},findUniqueOrThrow:async()=>({eventId:'event',event:{status:'publicado',startsAt:new Date('2099-01-01'),endsAt:new Date('2099-01-02')}})},eventAudit:{create:async()=>{audits++;}},eventNotice:{createMany:async()=>{notices++;}}};
mockModule(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{$transaction:async fn=>fn(tx)}}});
const {confirmEventPayment}=await import('../src/lib/event-payments.ts');
test('webhook e consulta repetidos não duplicam confirmação e lembretes',async()=>{
 await confirmEventPayment('registration');await confirmEventPayment('registration');assert.equal(paid,true);assert.equal(audits,1);assert.equal(notices,1);
});
