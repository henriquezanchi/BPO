import {test} from 'node:test';import assert from 'node:assert/strict';
import {sendWhatsAppMessage} from '../src/lib/whatsapp/send.ts';
test('canal de integrantes não declara sucesso ou envia dados para o CallMeBot de suporte',async()=>{
 const result=await sendWhatsAppMessage('numero-ficticio','Texto fictício');assert.equal(result.ok,false);assert.match(result.error,/não conectado/);
});
