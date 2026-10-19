// Grava uma regra nova em regras.json — usado pelo formulário "Criar
// regra" da tela web, pra não precisar editar o JSON na mão toda vez que
// aparece um tipo de lançamento novo e recorrente (ex: a mensalidade de
// uma pessoa específica, ou um fornecedor fixo).
//
// Validação aqui é a MESMA que carregarRegras() (lib/regras.js) já aplica
// ao ler o arquivo — nunca grava uma regra que o próprio carregador
// rejeitaria depois.
//
// As funções recebem e devolvem o conteúdo já lido ({regras: [...]}) —
// quem chama decide onde ler/gravar (disco ou Redis, ver
// lib/armazenamento.js). Elas alteram `json` no lugar.

import { validarItensRecibo } from './reciboComposto.js';

const TELAS_VALIDAS = [
  'pagamento_outros',
  'recebimento_contribuicao',
  'recebimento_doacao',
  'recebimento_avulso',
  'recebimento_inscricao',
  'transferencia',
  'recebimento_composto',
];

export function validarNovaRegra(regra) {
  if (!regra || typeof regra !== 'object') throw new Error('Regra inválida.');
  if (!regra.nome || !regra.nome.trim()) throw new Error('Dê um nome pra essa regra.');
  if (!Array.isArray(regra.contem) || regra.contem.filter((p) => p && p.trim()).length === 0) {
    throw new Error('Informe ao menos uma palavra-chave ("contém").');
  }
  if (!regra.acao || !TELAS_VALIDAS.includes(regra.acao.tela)) {
    throw new Error('Escolha uma ação válida (Pagamento Outros, Recebimento > Contribuições, Doações, Avulsos, Inscrições ou Transferência entre caixas).');
  }
  if (regra.acao.tela === 'recebimento_composto') {
    if (!regra.valorExato) throw new Error('Um recibo com vários itens vale só para o valor exato do Pix — falta o valor.');
    if (regra.aplicaEm !== 'credito') throw new Error('Um recibo com vários itens só vale para entradas (Pix recebido).');
    validarItensRecibo(regra.acao, regra.valorExato);
  }
  if (regra.acao.tela === 'transferencia' && !String(regra.acao.caixaOutro || '').trim()) {
    throw new Error('Escolha o outro caixa da transferência (para onde o dinheiro vai, ou de onde ele veio).');
  }
  if (regra.acao.tela === 'recebimento_contribuicao' && !String(regra.acao.matricula || '').trim()) {
    throw new Error('Matrícula é obrigatória para Recebimento > Contribuições — a busca por nome não é confiável (veja RUBRICAS_CONTRIBUICAO.md).');
  }
  if ((regra.acao.tela === 'pagamento_outros' || regra.acao.tela === 'recebimento_doacao') && !regra.acao.rubricaId) {
    throw new Error('Escolha uma rubrica.');
  }
  if ((regra.acao.tela === 'recebimento_avulso' || regra.acao.tela === 'recebimento_inscricao') && !String(regra.acao.rubricaNome || '').trim()) {
    throw new Error('Informe o nome EXATO da rubrica, como aparece na lista do Mercúrio (Avulsos/Inscrições não têm uma lista com id pra escolher, é sempre pelo nome).');
  }
  if (regra.valorExato !== undefined && regra.valorExato !== null) {
    const v = Number(regra.valorExato);
    if (isNaN(v) || v <= 0) throw new Error('O valor exato da regra precisa ser um número maior que zero (ou deixe a opção desmarcada).');
  }
}

function garantirLista(json) {
  if (!Array.isArray(json.regras)) json.regras = [];
}

export function adicionarRegra(json, novaRegra) {
  validarNovaRegra(novaRegra);
  garantirLista(json);

  const regraFinal = {
    nome: novaRegra.nome.trim(),
    ativa: novaRegra.ativa !== false,
    contem: novaRegra.contem.map((p) => p.trim()).filter(Boolean),
    ...(novaRegra.aplicaEm ? { aplicaEm: novaRegra.aplicaEm } : {}),
    ...(novaRegra.valorExato ? { valorExato: Number(novaRegra.valorExato) } : {}),
    acao: novaRegra.acao,
  };
  json.regras.push(regraFinal);
  return { regras: json.regras, regraCriada: regraFinal };
}

// Atualiza uma regra já existente, no lugar exato dela no arquivo —
// `indice` vem de `regra._indiceArquivo` (ver carregarRegras() em
// lib/regras.js), a posição real dela em regras.json, não a posição entre
// só as regras ativas. Pedido do usuário: um ícone de editar logo abaixo
// da regra já aplicada num lançamento, pra não precisar editar o JSON na
// mão pra corrigir uma regra que já existe.
export function editarRegra(json, indice, regraAtualizada) {
  validarNovaRegra(regraAtualizada);
  if (!Array.isArray(json.regras) || !json.regras[indice]) {
    throw new Error('Não achei essa regra no arquivo — ele pode ter mudado desde que a tela carregou. Gere o plano de novo e tente editar de novo.');
  }

  const anterior = json.regras[indice];
  const regraFinal = {
    nome: regraAtualizada.nome.trim(),
    // Sem "ativa" no pedido, mantém como estava (o formulário do plano não
    // mexe nisso; a tela de configuração de regras manda explicitamente).
    ativa: typeof regraAtualizada.ativa === 'boolean' ? regraAtualizada.ativa : anterior.ativa !== false,
    contem: regraAtualizada.contem.map((p) => p.trim()).filter(Boolean),
    ...(regraAtualizada.aplicaEm ? { aplicaEm: regraAtualizada.aplicaEm } : {}),
    ...(regraAtualizada.valorExato ? { valorExato: Number(regraAtualizada.valorExato) } : {}),
    acao: regraAtualizada.acao,
  };
  json.regras[indice] = regraFinal;
  return { regras: json.regras, regraEditada: regraFinal };
}

// Apaga uma regra de vez (não é "ativa: false" — remove a linha do
// arquivo) — pedido do usuário: opção de excluir dentro do "Editar regra",
// pra voltar a lançar aquela transação manualmente (ou deixar uma nova
// regra pegar no lugar dela). `indice` é a mesma posição real em
// regras.json usada por editarRegra().
export function removerRegra(json, indice) {
  if (!Array.isArray(json.regras) || !json.regras[indice]) {
    throw new Error('Não achei essa regra no arquivo — ele pode ter mudado desde que a tela carregou. Gere o plano de novo e tente excluir de novo.');
  }

  const [regraRemovida] = json.regras.splice(indice, 1);
  return { regras: json.regras, regraRemovida };
}

// Substitui ou acrescenta várias regras de uma vez (importar um .json
// exportado pela tela de configuração). Valida TODAS antes de mexer em
// qualquer coisa — um arquivo com uma regra inválida não grava nada.
export function importarRegras(json, regrasNovas, modo) {
  if (!Array.isArray(regrasNovas) || regrasNovas.length === 0) throw new Error('O arquivo não tem nenhuma regra.');
  if (modo !== 'substituir' && modo !== 'acrescentar') throw new Error('Modo de importação inválido.');
  regrasNovas.forEach((r, i) => {
    try {
      validarNovaRegra(r);
    } catch (e) {
      throw new Error(`Regra ${i + 1} ("${(r && r.nome) || 'sem nome'}") do arquivo: ${e.message}`);
    }
  });
  const limpas = regrasNovas.map((r) => ({
    nome: r.nome.trim(),
    ativa: r.ativa !== false,
    contem: r.contem.map((p) => p.trim()).filter(Boolean),
    ...(r.aplicaEm ? { aplicaEm: r.aplicaEm } : {}),
    ...(r.valorExato ? { valorExato: Number(r.valorExato) } : {}),
    acao: r.acao,
  }));
  garantirLista(json);
  json.regras = modo === 'substituir' ? limpas : [...json.regras, ...limpas];
  return { regras: json.regras, importadas: limpas.length };
}
