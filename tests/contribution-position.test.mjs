import assert from 'node:assert/strict';import test from 'node:test';
import {contributionPosition,paymentReviewStage} from '../src/lib/contribution-position.ts';
test('pagamento confirmado remove atraso mesmo com escola defasada, sem inventar meses ou valores',()=>{
 const rows=contributionPosition([{year:2025,month:12,status:'atrasado'},{year:2026,month:1,status:'em_branco'}],[{referenceYear:2025,referenceMonth:12,status:'pago'},{referenceYear:2025,referenceMonth:12,status:'pendente'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].overdue,false);assert.equal(rows[0].open,false);assert.equal(rows[0].label,'Recebido pelo Portal');assert.equal('amount' in rows[0],false);
 assert.equal(contributionPosition([],[]).length,0);
});
test('isenção e recibo oficial não viram dívida por existir cobrança pendente',()=>{
 for(const status of ['paga','isento']){const [row]=contributionPosition([{year:2026,month:1,status}],[{referenceYear:2026,referenceMonth:1,status:'pendente'}]);assert.equal(row.open,false);}
});
test('fila distingue recebimento, lançamento, ausência de tarefa e falhas',()=>{
 assert.equal(paymentReviewStage('pendente',[{status:'sincronizado'}]).key,'aguardando');
 assert.equal(paymentReviewStage('pago',[{status:'pendente'}]).key,'pendente');
 assert.equal(paymentReviewStage('pago',[{status:'falhou'}]).key,'conferir');
 assert.equal(paymentReviewStage('pago',[]).key,'conferir');
 assert.equal(paymentReviewStage('pago',[{status:'sincronizado'}]).key,'registrado');
 assert.equal(paymentReviewStage('pago',[{status:'sincronizado'},{status:'falhou'}]).key,'conferir');
});
