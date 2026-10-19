import {test} from 'node:test';import assert from 'node:assert/strict';
import {eventPosterExtension,MAX_EVENT_POSTER_BYTES} from '../src/lib/event-poster-file.ts';
test('cartaz aceita somente assinatura de imagem permitida, MIME coerente e limite de tamanho',()=>{
 assert.equal(eventPosterExtension(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),'png');
 assert.equal(eventPosterExtension(new Uint8Array([255,216,255,0]),'image/jpeg'),'jpg');
 assert.throws(()=>eventPosterExtension(new TextEncoder().encode('<svg><script/></svg>'),'image/png'));
 assert.throws(()=>eventPosterExtension(new Uint8Array([255,216,255]),'image/svg+xml'));
 assert.throws(()=>eventPosterExtension(new Uint8Array(MAX_EVENT_POSTER_BYTES+1),'image/png'));
});
