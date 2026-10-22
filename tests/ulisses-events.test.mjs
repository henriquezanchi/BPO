import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agendaUlissesBranchWhere } from '../src/lib/event-policy.ts';
import { ehCopia, ulissesOccurrences } from '../src/lib/ulisses/events.ts';
import { paraAgenda } from '../src/lib/ulisses/navegador.ts';

const sample = {
  id: 123,
  nome: 'Palestra',
  linkFinal: 'https://inscricao.acropolebrasil.com.br/?eventoId=123',
  dadoPequeno: '<p>Descrição pública</p>',
  filiaisEventos: [
    { ativo: true, filial: { id: 132, nome: 'Escola A' }, produtos: [{ id: 1, dataEvento: '2099-01-01T19:00:00Z' }, { id: 2, dataEvento: '2099-01-02T19:00:00Z' }] },
    { ativo: true, filial: { id: 999, nome: 'Escola B' }, produtos: [{ id: 3, dataEvento: '2099-01-03T19:00:00Z' }] },
  ],
};

test('normaliza as sessões da filial consultada com o público público explícito', () => {
  const result = ulissesOccurrences(sample, 132, 'school-a');
  assert.equal(result.length, 2);
  assert.equal(result[0].externalUid, 'ulisses:123:132:1');
  assert.equal(result[0].source, 'ulisses');
  assert.equal(result[0].scope, 'filial');
  assert.equal(result[0].audience, 'todos_ativos');
  assert.deepEqual(result[0].publicos, ['todos_ativos']);
  assert.equal(result[0].schoolId, 'school-a');
  assert.match(result[0].registrationUrl, /eventoId=123/);
  assert.equal(result[0].description.includes('<p>'), false);
  assert.deepEqual(result, ulissesOccurrences(sample, 132, 'school-a'));

  const participatingBranch = ulissesOccurrences(sample, 999, 'school-b');
  assert.equal(participatingBranch.length, 1);
  assert.equal(participatingBranch[0].externalUid, 'ulisses:123:999:3');
  assert.equal(participatingBranch[0].schoolId, 'school-b');
});

test('mantém as ocorrências de Ulisses na filial de origem e preserva eventos manuais abertos', () => {
  assert.deepEqual(agendaUlissesBranchWhere('school-a'), {
    OR: [{ source: { not: 'ulisses' } }, { source: 'ulisses', schoolId: 'school-a' }],
  });
});

test('omite outra filial, rascunhos, cancelamentos e cópias da Agenda pública', () => {
  assert.equal(ulissesOccurrences(sample, 77, 'other-school').length, 0);
  assert.equal(paraAgenda([sample], 77, 'other-school').length, 0);

  const draft = { ...sample, publicar: false };
  assert.equal(ulissesOccurrences(draft, 132, 'school-a').length, 0);
  assert.equal(paraAgenda([draft], 132, 'school-a').length, 0);

  const canceled = {
    ...sample,
    filiaisEventos: [{ ...sample.filiaisEventos[0], ativo: false }],
  };
  assert.equal(ulissesOccurrences(canceled, 132, 'school-a')[0].status, 'cancelado');
  assert.equal(paraAgenda([canceled], 132, 'school-a').length, 0);

  const copy = { ...sample, nome: '[CÓPIA] Palestra' };
  assert.equal(ehCopia(copy.nome), true);
  assert.equal(ulissesOccurrences(copy, 132, 'school-a').length, 0);
  assert.equal(paraAgenda([copy], 132, 'school-a').length, 0);
});

test('recusa URL executável e identifica os marcadores conhecidos de cópia', () => {
  const result = ulissesOccurrences({ ...sample, linkFinal: 'javascript:alert(1)' }, 132, 'school-a');
  assert.equal(result[0].registrationUrl, null);
  assert.equal(ehCopia('Cópia de Palestra'), true);
  assert.equal(ehCopia('Palestra (copia)'), true);
});

test('ignora DTOs malformados sem descartar eventos válidos do mesmo lote', () => {
  const malformed = [null, { ...sample, nome: undefined }, { ...sample, nome: 123 }];
  const result = paraAgenda([...malformed, sample], 132, 'school-a');
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((event) => event.externalUid), ['ulisses:123:132:1', 'ulisses:123:132:2']);
});
