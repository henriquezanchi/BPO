import {test} from 'node:test';import assert from 'node:assert/strict';
import {eventoCompartilhavel,linkDoCanal,textoParaCanal,horaCurta,nomeDoArquivo} from '../src/lib/compartilhar-evento.ts';
const agora=new Date('2026-10-19T12:00:00Z');
const base={title:'Palestra: Filosofia para viver',date:new Date('2026-10-25T22:00:00Z'),allDay:false,location:'Nova Acrópole Barra',description:'Uma noite sobre os clássicos.',source:'ulisses',status:'publicado',registrationUrl:'https://inscricao.acropolebrasil.com.br/?eventoId=9'};
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
 assert.match(wa,/^\*Palestra: Filosofia para viver\*\n\n📅 domingo, 25 de outubro, às 19h\n📍 Nova Acrópole Barra/);
 assert.ok(wa.endsWith('Inscrições: https://inscricao.acropolebrasil.com.br/?eventoId=9'));
 assert.match(textoParaCanal(e,'instagram'),/#NovaAcrópole/);
 assert.ok(linkDoCanal(e,'whatsapp').startsWith('https://wa.me/?text=*Palestra%3A'));
 const tg=new URL(linkDoCanal(e,'telegram'));assert.equal(tg.searchParams.get('url'),e.registrationUrl);assert.equal(tg.searchParams.get('text').includes('Inscrições:'),false);
 assert.equal(new URL(linkDoCanal(e,'facebook')).searchParams.get('u'),e.registrationUrl);
 assert.equal(nomeDoArquivo(e,'story'),'palestra-filosofia-para-viver-story.png');
});
