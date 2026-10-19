// Formatação compartilhada entre o CLI e o servidor web — nunca duplicar
// esses textos em mais de um lugar.

export function formatarMoeda(v) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function nomeTela(tela) {
  if (tela === 'pagamento_outros') return 'Pagamento Outros';
  if (tela === 'recebimento_contribuicao') return 'Recebimento > Contribuições';
  if (tela === 'recebimento_avulso') return 'Recebimento > Avulsos';
  if (tela === 'recebimento_inscricao') return 'Recebimento > Inscrições';
  if (tela === 'transferencia') return 'Transferência entre caixas';
  if (tela === 'recebimento_composto') return 'Recebimento > Vários itens (um recibo)';
  return 'Recebimento > Doações';
}

export function dataHojeBR() {
  const hoje = new Date();
  return `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
}
