// mock.module compatível entre versões do Node.
//
// Os testes descrevem o módulo falso com `{ exports: {...} }`, a forma nova da
// API. O Node 24 (o instalado nas máquinas da equipe) só entende
// `namedExports`/`defaultExport` e IGNORA `exports` em silêncio: o módulo vira
// um objeto vazio e o código testado quebra com "x is not a function".
// Este auxiliar detecta o suporte uma vez e traduz quando preciso.
import { mock } from 'node:test';

const sonda = new URL('./sonda-mock.mjs', import.meta.url).href;
const contexto = mock.module(sonda, { exports: { suportaExports: true } });
const { suportaExports } = await import(sonda);
contexto.restore();

export function mockModule(especificador, opcoes = {}) {
  if (suportaExports || !('exports' in opcoes)) return mock.module(especificador, opcoes);
  const { exports: exportados, ...resto } = opcoes;
  const { default: padrao, ...nomeados } = exportados ?? {};
  return mock.module(especificador, {
    ...resto,
    namedExports: nomeados,
    ...(padrao !== undefined ? { defaultExport: padrao } : {}),
  });
}
