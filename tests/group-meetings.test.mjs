import assert from 'node:assert/strict';import test from 'node:test';
import {meetingOccurrences,localInZone,validMeetingResponse,parseLocal} from '../src/lib/group-meetings.ts';
const base={title:'Reunião teste',startsLocal:'2026-11-01T19:00',endsLocal:'2026-11-01T20:30',timeZone:'America/Sao_Paulo',publicDetails:'Oficina',internalDetails:'Registro reservado',fullUniform:true};
test('cria somente a ocorrência pedida ou a série semanal até a data informada',()=>{
 assert.equal(meetingOccurrences(base,0).length,1);
 const rows=meetingOccurrences({...base,repeatUntil:'2026-11-15'},0);assert.equal(rows.length,3);assert.equal(rows[2].startsAt.toISOString(),'2026-11-15T22:00:00.000Z');
});
test('recorrência mantém o horário local ao atravessar o fim do horário de verão',()=>{
 const rows=meetingOccurrences({...base,startsLocal:'2026-10-25T19:00',endsLocal:'2026-10-25T20:00',timeZone:'America/New_York',repeatUntil:'2026-11-08'},0);
 assert.equal(rows[0].startsAt.toISOString(),'2026-10-25T23:00:00.000Z');assert.equal(rows[2].startsAt.toISOString(),'2026-11-09T00:00:00.000Z');assert.equal(localInZone(rows[2].startsAt,'America/New_York'),'2026-11-08T19:00');
});
test('rejeita datas normalizadas, horário inexistente, duração negativa, passado e séries excessivas',()=>{
 assert.throws(()=>parseLocal('2026-02-30T19:00','America/Sao_Paulo'));
 assert.throws(()=>parseLocal('2027-03-14T02:30','America/New_York'));
 assert.throws(()=>meetingOccurrences({...base,endsLocal:base.startsLocal},0));
 assert.throws(()=>meetingOccurrences(base,Date.parse('2027-01-01')));
 assert.throws(()=>meetingOccurrences({...base,repeatUntil:'2029-01-01'},0));
});
test('ausência exige justificativa breve; confirmação não significa comparecimento realizado',()=>{
 assert.throws(()=>validMeetingResponse('ausencia_justificada',' '));assert.throws(()=>validMeetingResponse('presente',''));
 assert.doesNotThrow(()=>validMeetingResponse('ausencia_justificada','Compromisso já combinado.'));assert.doesNotThrow(()=>validMeetingResponse('confirmado',''));
});
