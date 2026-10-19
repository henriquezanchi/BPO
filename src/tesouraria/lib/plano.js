// Monta o "plano de importação" (transação + regra combinada, se houver) —
// usado tanto pelo modo de conferência do CLI quanto pela tela de revisão
// do servidor web. Nunca decide sozinho o que fazer com uma transação sem
// regra: ela só entra no plano marcada como tal.

import { combinarRegra } from './regras.js';
import { nomeTela } from './formato.js';
import { descreverRecibo } from './reciboComposto.js';

export function montarPlano(transacoes, regras) {
  return transacoes.map((t) => {
    const regra = combinarRegra(t, regras);
    return { transacao: t, regra, acao: regra ? regra.acao : null };
  });
}

export function detalheAcao(item) {
  if (!item.acao) return null;
  if (item.acao.tela === 'recebimento_contribuicao') {
    return `matrícula ${item.acao.matricula}${item.acao.mesReferencia ? ` / mês ${item.acao.mesReferencia}` : ' / mês detectado automaticamente pelo valor'}`;
  }
  if (item.acao.tela === 'recebimento_composto') return descreverRecibo(item.acao);
  if (item.acao.tela === 'transferencia') {
    return item.transacao.tipo === 'credito'
      ? `vindo do caixa "${item.acao.caixaOutro}"`
      : `para o caixa "${item.acao.caixaOutro}"`;
  }
  return `rubrica "${item.acao.rubricaNome || item.acao.rubricaId}"`;
}

export function resumoPlano(plano) {
  const comRegra = plano.filter((i) => i.regra).length;
  return { total: plano.length, comRegra, semRegra: plano.length - comRegra };
}

export { nomeTela };
