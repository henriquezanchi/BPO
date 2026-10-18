import assert from 'node:assert/strict';import test from 'node:test';
import {meetingOccurrences,localInZone,validMeetingResponse,parseLocal,seriesOccurrences} from '../src/lib/group-meetings.ts';
const base={title:'Reunião teste',startsLocal:'2026-11-01T19:00',endsLocal:'2026-11-01T20:30',timeZone:'America/Sao_Paulo',publicDetails:'Oficina',internalDetails:'Registro reservado',fullUniform:true};
test('rotina semanal não vence após um ano; janela de exibição continua sendo gerada anos depois',()=>{
 assert.equal(meetingOccurrences(base,0).length,1);
 assert.equal(meetingOccurrences({...base,weekly:true},0).length,12);
 const rows=seriesOccurrences({...base,untilSlot:null},Date.parse('2029-11-01'));
 assert.equal(rows.length,12);assert.ok(rows[0].startsAt.getUTCFullYear()>=2029);assert.match(localInZone(rows[0].startsAt,base.timeZone),/T19:00$/);
});
test('recorrência mantém o horário local ao atravessar o fim do horário de verão',()=>{
 const rows=meetingOccurrences({...base,weekly:true,startsLocal:'2026-10-25T19:00',endsLocal:'2026-10-25T20:00',timeZone:'America/New_York'},0);
 assert.equal(rows[0].startsAt.toISOString(),'2026-10-25T23:00:00.000Z');assert.equal(rows[2].startsAt.toISOString(),'2026-11-09T00:00:00.000Z');assert.equal(localInZone(rows[2].startsAt,'America/New_York'),'2026-11-08T19:00');
});
test('alteração desta e das seguintes modifica também ocorrências ainda não materializadas; encerrar rotina limita gerações futuras',()=>{
 const series={...base,untilSlot:null,changes:[{fromSlot:'2026-11-08T19:00',startsLocal:'2026-11-09T20:00',endsLocal:'2026-11-09T21:00',timeZone:base.timeZone}]};
 const rows=seriesOccurrences(series,Date.parse('2027-11-01'));
 assert.equal(rows.length,12);assert.match(localInZone(rows[0].startsAt,base.timeZone),/T20:00$/);assert.equal(new Date(rows[0].startsAt).getUTCDay(),1);
 assert.equal(seriesOccurrences({...series,untilSlot:'2026-11-15T19:00'},Date.parse('2027-01-01')).length,0);
});
test('rejeita datas normalizadas, horário inexistente, duração negativa e passado',()=>{
 assert.throws(()=>parseLocal('2026-02-30T19:00','America/Sao_Paulo'));assert.throws(()=>parseLocal('2027-03-14T02:30','America/New_York'));
 assert.throws(()=>meetingOccurrences({...base,endsLocal:base.startsLocal},0));assert.throws(()=>meetingOccurrences(base,Date.parse('2027-01-01')));
});
test('ausência exige justificativa breve; confirmação não significa comparecimento realizado',()=>{
 assert.throws(()=>validMeetingResponse('ausencia_justificada',' '));assert.throws(()=>validMeetingResponse('presente',''));assert.doesNotThrow(()=>validMeetingResponse('ausencia_justificada','Compromisso já combinado.'));assert.doesNotThrow(()=>validMeetingResponse('confirmado',''));
});
