import assert from 'node:assert/strict';import test from 'node:test';
import {assertContributionOrder,oldestOpenContribution,assertMercurioReference} from '../src/lib/contribution-order.ts';
test('não permite pagar futuro antes de quitar mês anterior, inclusive outro ano',()=>{
 const ledger=[{year:2025,month:12,status:'atrasado'},{year:2026,month:1,status:'em_branco'}];
 assert.throws(()=>assertContributionOrder({year:2026,month:2},ledger,[]),/12\/2025/);
 assert.doesNotThrow(()=>assertContributionOrder({year:2025,month:12},ledger,[]));
});
test('confirmação do gateway libera sequência mesmo antes da sincronização oficial',()=>{
 const ledger=[{year:2026,month:1,status:'atrasado'},{year:2026,month:2,status:'em_branco'}];const paid=[{referenceYear:2026,referenceMonth:1,status:'pago'}];
 assert.doesNotThrow(()=>assertContributionOrder({year:2026,month:2},ledger,paid));
 assert.throws(()=>assertContributionOrder({year:2026,month:1},ledger,paid),/já está pago/);
});
test('cobrança anterior pendente bloqueia e isenção oficial não é tratada como dívida',()=>{
 const charge=[{referenceYear:2026,referenceMonth:1,status:'pendente'}];
 assert.throws(()=>assertContributionOrder({year:2026,month:2},[],charge));
 assert.equal(oldestOpenContribution([{year:2026,month:1,status:'isento'}],charge),null);
 assert.doesNotThrow(()=>assertContributionOrder({year:2026,month:2},[],[]));
});

test("lançamento oficial bloqueia competência diferente mesmo que o valor seja igual",()=>{assert.doesNotThrow(()=>assertMercurioReference("09/2026",{year:2026,month:9}));assert.throws(()=>assertMercurioReference("08/2026",{year:2026,month:9}),/conferência humana/)});
