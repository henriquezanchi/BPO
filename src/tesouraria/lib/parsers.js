// Leitura de extratos bancários — OFX e CSV.
//
// OFX é sempre preferível quando o banco oferecer: tem um identificador
// único por transação (FITID), então é o formato mais confiável pra
// detectar duplicatas. CSV funciona bem também. PDF não é suportado aqui —
// se só tiver PDF, exporte OFX ou CSV do internet banking, ou converta o
// PDF pra CSV antes.
//
// Cada transação devolvida tem o formato:
//   { data: 'DD/MM/AAAA', valor: 123.45 (sempre positivo), tipo: 'credito'|'debito',
//     descricao: '...', idUnico: '...' (FITID do OFX, ou null pro CSV),
//     saldo: 1234.56|null (saldo do dia/após a transação, só quando o
//     próprio extrato traz essa coluna — usado na conferência de saldo
//     pós-lançamento; ver conciliarSaldos() em lib/executor.js) }

import fs from 'node:fs';

export function detectarFormato(caminhoArquivo) {
  const ext = caminhoArquivo.toLowerCase().split('.').pop();
  if (ext === 'ofx') return 'ofx';
  if (ext === 'csv') return 'csv';
  throw new Error(`Formato ".${ext}" não suportado. Use .ofx (preferível) ou .csv.`);
}

export function lerExtrato(caminhoArquivo) {
  const conteudo = fs.readFileSync(caminhoArquivo, 'utf-8');
  return lerExtratoDeConteudo(caminhoArquivo, conteudo);
}

// Mesma leitura, mas a partir de um conteúdo já em memória (nome do arquivo
// só pra detectar o formato pela extensão) — usada pelo servidor web, que
// recebe o texto do arquivo enviado pelo navegador em vez de um caminho no
// disco do servidor.
export function lerExtratoDeConteudo(nomeArquivo, conteudo) {
  const formato = detectarFormato(nomeArquivo);
  return formato === 'ofx' ? parseOfx(conteudo) : parseCsv(conteudo);
}

// --- OFX ---------------------------------------------------------------

function parseOfx(conteudo) {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || [];
  return blocos.map((bloco) => {
    const campo = (tag) => {
      const m = bloco.match(new RegExp(`<${tag}>([^\r\n<]*)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const trnamt = parseFloat(campo('TRNAMT').replace(',', '.'));
    const dtposted = campo('DTPOSTED'); // AAAAMMDDhhmmss[...]
    const ano = dtposted.slice(0, 4);
    const mes = dtposted.slice(4, 6);
    const dia = dtposted.slice(6, 8);
    const memo = campo('MEMO') || campo('NAME');
    return {
      data: `${dia}/${mes}/${ano}`,
      valor: Math.abs(trnamt),
      tipo: trnamt >= 0 ? 'credito' : 'debito',
      descricao: memo,
      idUnico: campo('FITID') || null,
      // OFX padrão não traz saldo por transação (só um <LEDGERBAL> único,
      // de todo o extrato, sem granularidade por dia) — sem essa
      // precisão, a conferência de saldo pós-lançamento fica desativada
      // pra extratos OFX (ver conciliarSaldos() em lib/executor.js).
      saldo: null,
    };
  });
}

// --- CSV -----------------------------------------------------------------

const PALAVRAS_DATA = ['data', 'date'];
const PALAVRAS_VALOR = ['valor', 'value', 'amount', 'montante'];
const PALAVRAS_TIPO = ['tipo', 'type', 'natureza'];
const PALAVRAS_DESCRICAO = ['descricao', 'descrição', 'historico', 'histórico', 'memo', 'detalhe', 'lancamento', 'lançamento'];
const PALAVRAS_SALDO = ['saldo', 'balance'];

function normalizarCabecalho(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function acharColuna(cabecalhos, candidatos) {
  const norm = cabecalhos.map(normalizarCabecalho);
  for (const cand of candidatos) {
    const idx = norm.findIndex((c) => c.includes(cand));
    if (idx !== -1) return idx;
  }
  return -1;
}

function detectarSeparador(linha) {
  const contarFora = (sep) => (linha.match(new RegExp(`\\${sep}`, 'g')) || []).length;
  return contarFora(';') > contarFora(',') ? ';' : ',';
}

function partirLinhaCsv(linha, sep) {
  // Parser simples que respeita aspas — suficiente pra extratos bancários
  // (não há CSVs com campos multi-linha nesse contexto).
  const campos = [];
  let atual = '';
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      dentroAspas = !dentroAspas;
    } else if (c === sep && !dentroAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim().replace(/^"|"$/g, ''));
}

function parseValorBR(s) {
  let t = String(s).trim().replace(/[R$\s]/g, '');
  // Formato brasileiro "1.234,56" -> "1234.56"; formato "1234.56" já ok.
  if (/,\d{1,2}$/.test(t)) {
    t = t.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(t);
}

function parseCsv(conteudo) {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (linhas.length < 2) return [];
  const sep = detectarSeparador(linhas[0]);
  const cabecalhos = partirLinhaCsv(linhas[0], sep);

  const idxData = acharColuna(cabecalhos, PALAVRAS_DATA);
  const idxValor = acharColuna(cabecalhos, PALAVRAS_VALOR);
  const idxTipo = acharColuna(cabecalhos, PALAVRAS_TIPO);
  const idxDescricao = acharColuna(cabecalhos, PALAVRAS_DESCRICAO);
  // Opcional — nem todo banco inclui saldo corrente no CSV. Quando existe,
  // alimenta a conferência de saldo pós-lançamento (ver executor.js);
  // quando não existe, essa conferência simplesmente fica desativada.
  const idxSaldo = acharColuna(cabecalhos, PALAVRAS_SALDO);

  if (idxData === -1 || idxValor === -1) {
    throw new Error(
      `Não encontrei colunas de data/valor no CSV. Cabeçalhos lidos: ${cabecalhos.join(' | ')}`
    );
  }

  const transacoes = [];
  for (let i = 1; i < linhas.length; i++) {
    const cel = partirLinhaCsv(linhas[i], sep);
    if (cel.length <= idxData || cel.length <= idxValor) continue;
    const dataRaw = cel[idxData];
    let valor = parseValorBR(cel[idxValor]);
    if (!dataRaw || isNaN(valor)) continue;

    let tipo;
    if (idxTipo !== -1) {
      const t = normalizarCabecalho(cel[idxTipo] || '');
      if (/^d[ée]bit|^saida|^saída/.test(t)) tipo = 'debito';
      else if (/^cr[ée]dit|^entrada/.test(t)) tipo = 'credito';
      else tipo = valor >= 0 ? 'credito' : 'debito';
    } else {
      tipo = valor >= 0 ? 'credito' : 'debito';
    }
    valor = Math.abs(valor);

    const descricao = idxDescricao !== -1
      ? cel[idxDescricao]
      : cel.filter((_, i) => i !== idxData && i !== idxValor && i !== idxTipo).join(' ');

    // Normaliza a data pro formato DD/MM/AAAA (aceita AAAA-MM-DD ou DD/MM/AAAA).
    let data = dataRaw;
    const isoMatch = dataRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) data = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

    let saldo = null;
    if (idxSaldo !== -1 && cel.length > idxSaldo) {
      const saldoNum = parseValorBR(cel[idxSaldo]);
      if (!isNaN(saldoNum)) saldo = saldoNum;
    }

    transacoes.push({ data, valor, tipo, descricao: (descricao || '').trim(), idUnico: null, saldo });
  }
  return transacoes;
}
