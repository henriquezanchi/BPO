import {test} from 'node:test';import assert from 'node:assert/strict';
import {ulissesOccurrences} from '../src/lib/ulisses/events.ts';
const sample={id:123,nome:'Palestra',linkFinal:'https://inscricao.acropolebrasil.com.br/?eventoId=123',dadoPequeno:'<p>Descrição pública</p>',filiaisEventos:[{ativo:true,filial:{id:132,nome:'Escola'},produtos:[{id:1,dataEvento:'2099-01-01T19:00:00Z'},{id:2,dataEvento:'2099-01-02T19:00:00Z'}]},{filial:{id:999},produtos:[{id:3,dataEvento:'2099-01-03'}]}]};
test('adapta contrato já usado no CRM, respeita filial e cada sessão oficial',()=>{
 const result=ulissesOccurrences(sample,132,'school');assert.equal(result.length,2);assert.equal(result[0].externalUid,'ulisses:123:132:1');assert.equal(result[0].source,'ulisses');assert.equal(result[0].audience,'todos_ativos');assert.equal(result[0].schoolId,'school');assert.match(result[0].registrationUrl,/eventoId=123/);assert.equal(result[0].description.includes('<p>'),false);
 assert.deepEqual(result,ulissesOccurrences(sample,132,'school'));
});
test('não publica em outra filial, não aceita URL executável e respeita cancelamento explícito',()=>{
 assert.equal(ulissesOccurrences(sample,77,'school').length,0);
 const result=ulissesOccurrences({...sample,linkFinal:'javascript:alert(1)',filiaisEventos:[{...sample.filiaisEventos[0],ativo:false}]},132,'school');assert.equal(result[0].registrationUrl,null);assert.equal(result[0].status,'cancelado');
});
