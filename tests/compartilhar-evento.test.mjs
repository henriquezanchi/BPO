import {test} from 'node:test';import assert from 'node:assert/strict';
import {eventoCompartilhavel,linkDoCanal,textoParaCanal,horaCurta,nomeDoArquivo} from '../src/lib/compartilhar-evento.ts';
const agora=new Date('2026-10-19T12:00:00Z');
const base={id:'evento-9',title:'Palestra: Filosofia para viver',date:new Date('2026-10-25T22:00:00Z'),allDay:false,location:'Nova Acrópole Barra',description:'Uma noite sobre os clássicos.',source:'ulisses',status:'publicado',registrationUrl:'https://inscricao.acropolebrasil.com.br/?eventoId=9'};
test('só compartilha evento público do Ulisses, publicado, com link e ainda por acontecer',()=>{
 assert.ok(eventoCompartilhavel(base,agora));
 assert.equal(eventoCompartilhavel({...base,source:'manual'},agora),null);
 assert.equal(eventoCompartilhavel({...base,status:'cancelado'},agora),null);
 assert.equal(eventoCompartilhavel({...base,registrationUrl:null},agora),null);
 assert.equal(eventoCompartilhavel({...base,date:new Date('2026-10-01T22:00:00Z')},agora),null);
});
test('texto de cada canal no formato dele, com horário de Brasília',()=>{
 const e=eventoCompartilhavel(base,agora);
 assert.equal(horaCurta(e.date),'19h');
 const wa=textoParaCanal(e,'whatsapp');
 // Abertura em tom de conversa e sem emoji (o WhatsApp do computador troca emoji por "?") — 22/10/2026.
 assert.match(wa,/^[^\n*]+\n\n\*Palestra: Filosofia para viver\*\ndomingo, 25 de outubro, às 19h\nNova Acrópole Barra/);
 assert.equal(/[\u{10000}-\u{10FFFF}]/u.test(wa),false);
 assert.ok(wa.endsWith('Inscrições: https://inscricao.acropolebrasil.com.br/?eventoId=9'));
 assert.match(textoParaCanal(e,'instagram'),/#NovaAcrópole/);
 assert.ok(linkDoCanal(e,'whatsapp').startsWith('https://wa.me/?text='));assert.ok(decodeURIComponent(linkDoCanal(e,'whatsapp')).includes('*Palestra: Filosofia para viver*'));
 const tg=new URL(linkDoCanal(e,'telegram'));assert.equal(tg.searchParams.get('url'),e.registrationUrl);assert.equal(tg.searchParams.get('text').includes('Inscrições:'),false);
 assert.equal(new URL(linkDoCanal(e,'facebook')).searchParams.get('u'),e.registrationUrl);
 assert.equal(nomeDoArquivo(e,'story'),'palestra-filosofia-para-viver-story.png');
});
