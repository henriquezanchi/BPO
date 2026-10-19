// Lê os catálogos de rubricas (RUBRICAS_PAGAMENTO.md / RUBRICAS_DOACAO.md)
// pra alimentar os seletores do formulário "Criar regra" da tela web — em
// vez de duplicar essas listas em código, lê direto da documentação que
// já é a fonte da verdade (confirmada ao vivo contra o Mercúrio).

import fs from 'node:fs';

// Só lê a tabela `| id | Nome |` que vem ANTES do primeiro subtítulo "## " —
// RUBRICAS_PAGAMENTO.md tem uma 2ª tabela (Fornecedores) depois de um "##",
// que não é uma rubrica e não deve entrar na lista.
function parseTabelaPrincipal(conteudo) {
  const primeiraSecao = conteudo.split(/\n##\s/)[0];
  const itens = [];
  for (const linha of primeiraSecao.split(/\r?\n/)) {
    const m = linha.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|$/);
    if (m) itens.push({ id: m[1], nome: m[2].trim() });
  }
  return itens;
}

function lerCatalogo(caminho) {
  if (!fs.existsSync(caminho)) return [];
  return parseTabelaPrincipal(fs.readFileSync(caminho, 'utf-8'));
}

export function carregarRubricas(raizProjeto) {
  return {
    pagamento: lerCatalogo(`${raizProjeto}/RUBRICAS_PAGAMENTO.md`),
    doacao: lerCatalogo(`${raizProjeto}/RUBRICAS_DOACAO.md`),
  };
}

// Mesma leitura, a partir do texto já carregado (disco ou Redis — ver
// lib/armazenamento.js).
export function rubricasDoTexto(conteudo) {
  return conteudo ? parseTabelaPrincipal(conteudo) : [];
}

// Regrava a PRIMEIRA tabela `| id | Nome |` de um .md com uma lista nova
// (lida ao vivo do Mercúrio, via importarRubricasDoMercurio() em
// lib/mercurioTesouraria.js) — preserva todo o resto do arquivo (título,
// texto explicativo, notas, a 2ª tabela de Fornecedores em
// RUBRICAS_PAGAMENTO.md) intacto, só troca as linhas de dado da tabela.
function substituirTabelaPrincipal(conteudo, itens) {
  const linhas = conteudo.split(/\r?\n/);
  const idxHeader = linhas.findIndex((l) => /^\|\s*id\s*\|\s*Nome\s*\|$/i.test(l.trim()));
  if (idxHeader === -1) throw new Error('Não encontrei a tabela "| id | Nome |" no arquivo — verifique se o formato do .md mudou.');
  const idxSeparador = idxHeader + 1;
  let fim = idxSeparador + 1;
  while (fim < linhas.length && /^\|.*\|$/.test(linhas[fim].trim())) fim++;

  const novasLinhas = itens.map((i) => `| ${i.id} | ${i.nome} |`);
  return [...linhas.slice(0, idxSeparador + 1), ...novasLinhas, ...linhas.slice(fim)].join('\n');
}

export function atualizarTextoRubricas(conteudo, itens) {
  const atualizado = substituirTabelaPrincipal(conteudo, itens);
  const hoje = new Date();
  const dataBR = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
  return atualizado.replace(/confirmad[ao] ao vivo em \d{2}\/\d{2}\/\d{4}/i, `confirmada ao vivo em ${dataBR}`);
}

export function atualizarArquivoRubricas(caminho, itens) {
  fs.writeFileSync(caminho, atualizarTextoRubricas(fs.readFileSync(caminho, 'utf-8'), itens), 'utf-8');
}
