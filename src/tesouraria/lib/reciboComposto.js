// Recebimento com VÁRIOS itens num recibo só (pedido do usuário,
// 10/10/2026): um único Pix que paga, por exemplo, duas mensalidades e a
// lanchonete — no Mercúrio, um recibo com 3 itens cuja soma é o valor do
// Pix. Regra do tipo "recebimento_composto":
//
//   acao: {
//     tela: 'recebimento_composto',
//     itens: [
//       { tipo: 'contribuicao', matricula: '37402', mesReferencia: '09/2026', valor: 140 },
//       { tipo: 'contribuicao', matricula: '37402', mesReferencia: '10/2026', valor: 130 },
//       { tipo: 'avulso', rubricaNome: 'LANCHONETE', valor: 22 },
//     ],
//     interessado?, complemento?, emitirRecibo?
//   }
//
// A soma dos itens TEM que ser igual ao valor da transação — por isso essa
// regra sempre trava no valor exato (valorExato = soma). Este módulo só
// valida/descreve; quem lança é lancarRecebimentoComposto() em
// lib/mercurioTesouraria.js.

export const TIPOS_ITEM_RECIBO = ['contribuicao', 'avulso', 'inscricao', 'doacao'];
const TOLERANCIA = 0.005;

export function somaItens(itens) {
  return Math.round((itens || []).reduce((s, i) => s + Number(i.valor || 0), 0) * 100) / 100;
}

export function formatarValor(v) {
  return Number(v).toFixed(2).replace('.', ',');
}

// Lança um Error com mensagem clara se algo estiver errado. `valorTotal`
// (opcional): o valor que a soma precisa bater (o valorExato da regra).
export function validarItensRecibo(acao, valorTotal) {
  const itens = acao && acao.itens;
  if (!Array.isArray(itens) || itens.length < 2) {
    throw new Error('Um recibo com vários itens precisa de pelo menos 2 itens.');
  }
  itens.forEach((item, i) => {
    const n = `Item ${i + 1}`;
    if (!item || !TIPOS_ITEM_RECIBO.includes(item.tipo)) throw new Error(`${n}: escolha o tipo (contribuição, avulso, inscrição ou doação).`);
    const valor = Number(item.valor);
    if (!(valor > 0)) throw new Error(`${n}: informe um valor maior que zero.`);
    if (item.tipo === 'contribuicao') {
      if (!String(item.matricula || '').trim()) throw new Error(`${n}: a matrícula é obrigatória para contribuição.`);
      // Mês opcional (pedido do usuário, 11/10/2026): sem mês, usa os
      // pendentes mais antigos, em ordem (2 contribuições = os 2 mais antigos).
      const mes = String(item.mesReferencia || '').trim();
      if (mes && !/^\d{2}\/\d{4}$/.test(mes)) {
        throw new Error(`${n}: o mês da contribuição deve estar no formato MM/AAAA (ex: 09/2026), ou deixe em branco para usar o mês pendente mais antigo.`);
      }
    }
    if ((item.tipo === 'avulso' || item.tipo === 'inscricao') && !String(item.rubricaNome || '').trim()) {
      throw new Error(`${n}: informe o nome exato da rubrica, como aparece no Mercúrio.`);
    }
    if (item.tipo === 'doacao' && !item.rubricaId) throw new Error(`${n}: escolha o tipo de doação.`);
  });
  if (valorTotal !== undefined && valorTotal !== null) {
    const soma = somaItens(itens);
    if (Math.abs(soma - Number(valorTotal)) >= TOLERANCIA) {
      throw new Error(`A soma dos itens (R$ ${formatarValor(soma)}) precisa ser igual ao valor da transação (R$ ${formatarValor(valorTotal)}).`);
    }
  }
}

export function descreverItem(item) {
  if (item.tipo === 'contribuicao') return `contribuição ${item.matricula} ${item.mesReferencia || '(mês pendente mais antigo)'} R$ ${formatarValor(item.valor)}`;
  if (item.tipo === 'doacao') return `doação "${item.rubricaNome || item.rubricaId}" R$ ${formatarValor(item.valor)}`;
  return `${item.tipo === 'inscricao' ? 'inscrição' : 'avulso'} "${item.rubricaNome}" R$ ${formatarValor(item.valor)}`;
}

export function descreverRecibo(acao) {
  const itens = acao.itens || [];
  return `${itens.length} itens: ${itens.map(descreverItem).join('; ')}`;
}
