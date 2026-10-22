import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkWhatsAppDoEvento, urlDoEventoNoPortal } from '../src/lib/compartilhar-evento.ts';

const portal = 'https://portal-na-one.vercel.app/portal';
const evento = {
  id: 'integracao-7', source: 'manual', status: 'publicado',
  title: '***Sábado de Integração***', date: new Date('2026-11-07T11:00:00Z'),
  allDay: false, location: 'Sede', price: 0,
  description: '8h: Café da manhã compartilhado\n8h30: Leitura e reflexão\n9h: Limpeza e manutenção\n11h30: Encerramento. Vamos cuidar juntos da nossa escola!',
};
const texto = (e) => new URL(linkWhatsAppDoEvento(e, portal)).searchParams.get('text');

test('evento interno compartilha convite, programação completa, local, gratuidade e link próprio', () => {
  const t = texto(evento);
  assert.match(t, /^Vamos participar juntos\?/);
  assert.match(t, /\n\*Sábado de Integração\*\n/);
  assert.ok(!t.includes('**'));
  assert.match(t, /sábado, 7 de novembro, às 8h\nSede/);
  assert.ok(t.includes(evento.description));
  assert.match(t, /Entrada gratuita/);
  assert.match(t, /conta Nova Acrópole/);
  assert.ok(t.endsWith(`${portal}?evento=integracao-7`));
});
test('descrições longas preservam programação e orientações no fim', () => {
  const description = 'Programação detalhada. '.repeat(50) + 'Encerramento às 11h30.';
  const t = texto({ ...evento, description, price: 35, lancheCompartilhado: true, participantInstructions: 'Leve luvas e garrafa de água.' });
  assert.ok(t.includes(description));
  assert.match(t, /Valor: R\$\s*35,00/);
  assert.match(t, /Lanche compartilhado: leve algo para partilhar/);
  assert.match(t, /Orientações: Leve luvas e garrafa de água/);
  assert.ok(!t.includes('Entrada gratuita'));
});
test('campos ausentes não inventam descrição ou preço e dia inteiro omite horário', () => {
  const t = texto({ ...evento, allDay: true, description: null, location: null, price: undefined });
  assert.ok(!t.includes('às 8h'));
  assert.ok(!t.includes('gratuita'));
  assert.ok(!t.includes('null'));
  assert.ok(!t.includes('undefined'));
});
test('link direto codifica o identificador sem perder outros parâmetros', () => {
  const u = new URL(urlDoEventoNoPortal('a/b?c&d', `${portal}?origem=agenda&evento=anterior`));
  assert.equal(u.pathname, '/portal');
  assert.equal(u.searchParams.get('evento'), 'a/b?c&d');
  assert.equal(u.searchParams.get('origem'), 'agenda');
});
test('eventos públicos continuam usando o link de inscrição externo', () => {
  const url = 'https://inscricao.acropolebrasil.com.br/?eventoId=9';
  const t = texto({ ...evento, source: 'ulisses', registrationUrl: url, date: new Date('2099-11-07T11:00:00Z') });
  assert.ok(t.endsWith(`Inscrições: ${url}`));
  assert.ok(!t.includes('?evento=integracao-7'));
});
