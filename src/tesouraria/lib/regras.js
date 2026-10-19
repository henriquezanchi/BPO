// Carrega e aplica as regras de categorização (regras.json) — o mapeamento
// "contraparte do Pix -> lançamento no Mercúrio" que você mesmo define e
// mantém. Uma transação SEM regra correspondente nunca é lançada
// automaticamente: ela sempre aparece no relatório como "SEM REGRA" pra
// você decidir (lançar manualmente, ou criar uma regra nova e rodar de novo).

import fs from 'node:fs';
import { validarItensRecibo } from './reciboComposto.js';

function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

export function carregarRegras(caminho) {
  if (!fs.existsSync(caminho)) {
    throw new Error(`Arquivo de regras não encontrado: ${caminho}. Copie regras.exemplo.json para regras.json e edite.`);
  }
  return prepararRegras(JSON.parse(fs.readFileSync(caminho, 'utf-8')));
}

// Mesma validação/marcação de carregarRegras(), a partir do conteúdo já
// lido — usado pelo servidor web, que pode ler as regras do Redis em vez
// do disco (ver lib/armazenamento.js).
export function prepararRegras(json) {
  const todas = (json && json.regras) || [];
  // Marca cada regra com sua posição real no arquivo (antes do filtro de
  // "ativa" abaixo) — sobrevive até o item do plano (mesma referência de
  // objeto, nunca clonada) e é o que permite editar/gravar de volta no
  // lugar certo do regras.json, mesmo que existam regras inativas
  // misturadas no meio.
  todas.forEach((r, i) => { r._indiceArquivo = i; });
  const regras = todas.filter((r) => r.ativa !== false);
  for (const r of regras) {
    if (!r.contem || !r.contem.length) throw new Error(`Regra "${r.nome || '(sem nome)'}" não tem "contem" (lista de palavras-chave).`);
    if (!r.acao || !r.acao.tela) throw new Error(`Regra "${r.nome || '(sem nome)'}" não tem "acao.tela" (pagamento_outros ou recebimento_contribuicao).`);
    if (!['pagamento_outros', 'recebimento_contribuicao', 'recebimento_doacao', 'recebimento_avulso', 'recebimento_inscricao', 'transferencia', 'recebimento_composto'].includes(r.acao.tela)) {
      throw new Error(`Regra "${r.nome}": "acao.tela" deve ser "pagamento_outros", "recebimento_contribuicao", "recebimento_doacao", "recebimento_avulso", "recebimento_inscricao", "transferencia" ou "recebimento_composto", veio "${r.acao.tela}".`);
    }
    if (r.acao.tela === 'recebimento_composto') {
      try {
        validarItensRecibo(r.acao, r.valorExato);
      } catch (e) {
        throw new Error(`Regra "${r.nome}": ${e.message}`);
      }
    }
    if (r.acao.tela === 'transferencia' && !r.acao.caixaOutro) {
      throw new Error(`Regra "${r.nome}": "acao.caixaOutro" é obrigatório para "transferencia" (o caixa do outro lado da transferência).`);
    }
    if (r.acao.tela === 'recebimento_contribuicao' && !r.acao.matricula) {
      throw new Error(`Regra "${r.nome}": "acao.matricula" é obrigatório para "recebimento_contribuicao" (a busca por nome no Mercúrio não é confiável — veja RUBRICAS_CONTRIBUICAO.md).`);
    }
  }
  return regras;
}

const TOLERANCIA_VALOR = 0.005;

// Devolve a regra que melhor combina com a transação (prioriza a
// palavra-chave mais longa/específica entre todas as regras candidatas),
// ou null se nenhuma regra combinar.
//
// "valorExato" (opcional, na regra): quando presente, a regra só combina
// se o VALOR da transação também bater — pedido do usuário (14/09/2026):
// um aluno que compra lanchonete (R$3,50) e livros (R$120,00) usa o MESMO
// nome/palavra-chave nos dois Pix, mas são categorias diferentes; sem
// travar por valor, a primeira regra criada (ex: "lanchonete") passaria a
// capturar TODO pagamento futuro dessa pessoa, incluindo os R$120 de
// livro. Regras sem "valorExato" continuam combinando só pela palavra-
// chave, como sempre (comportamento antigo preservado pra quem não
// precisa dessa trava).
export function combinarRegra(transacao, regras) {
  const descNorm = normalizar(transacao.descricao);
  let melhor = null;
  let melhorTamanho = -1;

  for (const regra of regras) {
    if (regra.aplicaEm && regra.aplicaEm !== transacao.tipo) continue;
    if (regra.valorExato !== undefined && regra.valorExato !== null
      && Math.abs(regra.valorExato - transacao.valor) >= TOLERANCIA_VALOR) continue;
    for (const palavra of regra.contem) {
      const palavraNorm = normalizar(palavra);
      if (palavraNorm && descNorm.includes(palavraNorm) && palavraNorm.length > melhorTamanho) {
        melhor = regra;
        melhorTamanho = palavraNorm.length;
      }
    }
  }
  return melhor;
}
