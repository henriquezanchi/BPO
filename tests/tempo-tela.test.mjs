import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contarPalavras, tempoDoSlide, TEMPO_MINIMO_MS, TEMPO_MAXIMO_MS } from '../src/lib/tempo-tela.ts';

const evento = { tipo: 'evento', id: 'e', semana: 'quarta', dia: '18', mes: 'nov', hora: '19h30', titulo: 'Dia Mundial da Filosofia', descricao: null, local: 'Sede', preco: 'Gratuito', publico: 'Aberto ao público', lanche: false, cartaz: null, qrSvg: '', linkVisivel: '', inscricaoNoPortal: false };

test('conta só palavras com letra ou número', () => {
  assert.equal(contarPalavras('Olá — mundo 2026 ✨', null, undefined), 3);
});
test('200 palavras por minuto, mais 3 s com cartaz, entre o mínimo e o máximo', () => {
  const descricao = Array(100).fill('palavra').join(' ');
  const semCartaz = tempoDoSlide({ ...evento, descricao });
  const comCartaz = tempoDoSlide({ ...evento, descricao, cartaz: 'https://x/c.jpg' });
  assert.equal(comCartaz - semCartaz, 3000);
  assert.ok(semCartaz > 30_000 && semCartaz < 40_000); // ~124 palavras ≈ 37 s
  assert.equal(tempoDoSlide({ tipo: 'frase', id: 'f', frases: [], inicio: 0 }, { texto: 'Conhece-te a ti mesmo.', autor: 'Sócrates', obra: null }), TEMPO_MINIMO_MS);
  assert.equal(tempoDoSlide({ ...evento, descricao: Array(400).fill('p').join(' ') }), TEMPO_MAXIMO_MS);
});
