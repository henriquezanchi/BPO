import assert from 'node:assert/strict';import {test,mock} from 'node:test';
let gatewayCalls=0;
mock.module(new URL('../src/lib/auth.ts',import.meta.url).href,{exports:{requireAuthenticatedMember:async()=>({id:'m'})}});
mock.module(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{contributionMonthlyStatus:{findMany:async()=>[{year:2025,month:12,status:'atrasado'}]},paymentCharge:{findMany:async()=>[],findFirst:async()=>{throw new Error('Não deve buscar checkout posterior');}}}}});
const gateway=()=>{gatewayCalls++;throw new Error('Gateway nunca deve ser chamado');};
mock.module(new URL('../src/lib/asaas/client.ts',import.meta.url).href,{exports:Object.fromEntries(['asaasCancelPayment','asaasCreateCreditCardCharge','asaasCreatePixCharge','asaasFindOrCreateCustomer','asaasGetCreditCardFeeStatus','asaasGetPaymentStatus','asaasGetPixQrCode'].map(k=>[k,gateway]))});
mock.module(new URL('../src/lib/asaas/confirm-payment.ts',import.meta.url).href,{exports:{confirmarPagamento:async()=>{}}});
mock.module(new URL('../src/lib/asaas/split.ts',import.meta.url).href,{exports:{calcularSplitEscola:gateway,calcularSplitEscolaCartao:gateway}});
mock.module(new URL('../src/lib/member-data.ts',import.meta.url).href,{exports:{OVERDUE_STATUSES:new Set()}});
const {createContributionCharge,getPendingContributionCharge}=await import('../src/lib/actions/payment-actions.ts');
test('não cria nem recupera checkout de mês posterior quando há competência anterior em aberto',async()=>{
 await assert.rejects(()=>createContributionCharge('m',2026,1,'00000000000'),/12\/2025/);
 await assert.rejects(()=>getPendingContributionCharge('m',2026,1),/12\/2025/);
 assert.equal(gatewayCalls,0);
});
