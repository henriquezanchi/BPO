// Núcleo do lançamento real (abre o navegador, loga, lança cada transação
// do plano) — compartilhado entre o CLI (importar-extrato.js) e o servidor
// web (web/servidor.js), pra nunca ter 2 versões da mesma lógica
// divergindo. Quem chama decide COMO mostrar/perguntar (console+readline no
// CLI, Server-Sent Events + um botão no servidor web) através de `log` e
// `perguntar` — este módulo não sabe nada sobre terminal nem HTTP.

import { abrirNavegador, login, abrirTesourariaDaFilial } from './mercurioAuth.js';
import {
  abrirDia,
  lerLancamentosExistentes,
  acharLancamentosParecidos,
  lancarPagamentoOutros,
  lancarRecebimentoContribuicao,
  lancarRecebimentoDoacao,
  lancarRecebimentoAvulsoOuInscricao,
  lerSaldoDoDia,
  reaproveitarDiaAberto,
  lancarTransferencia,
  lancarRecebimentoComposto,
} from './mercurioTesouraria.js';
import { validarEnv, resolverCredenciais, resolverFilial, resolverCaixa } from './configuracao.js';

// Reexportadas — o CLI (importar-extrato.js, atualizar-rubricas.js) importa daqui.
export { validarEnv, resolverCredenciais, resolverFilial, resolverCaixa };

// Tolerância pra conferência de saldo pós-lançamento — mais folgada que a
// usada pra bater o valor de UMA transação (0,005) porque aqui é a soma
// de um dia inteiro, com espaço maior pra arredondamento acumulado.
const TOLERANCIA_SALDO = 0.01;

// Revisita (SÓ LEITURA) o calendário de cada dia/caixa que teve algo
// lançado nesta rodada e compara o Saldo que o Mercúrio mostra contra o
// saldo que o próprio extrato trouxe pra aquele dia (só disponível quando
// o CSV tem coluna de saldo — ver lib/parsers.js; OFX nunca tem essa
// granularidade). Pedido do usuário: detectar uma possível diferença de
// caixa ANTES de fechar o lote, em vez de só confiar que "lançou sem erro
// = está tudo certo". Melhor esforço — uma falha ao ler um dia específico
// não trava o relatório final, só fica sem essa informação pra esse dia.
async function conciliarSaldos(page, saldosExtratoPorDia) {
  const diferencas = [];
  let diasConferidos = 0;
  for (const { data, caixa, saldoExtrato } of saldosExtratoPorDia.values()) {
    try {
      const saldoMercurio = await lerSaldoDoDia(page, caixa, data);
      if (saldoMercurio === null) continue;
      diasConferidos++;
      if (Math.abs(saldoMercurio - saldoExtrato) >= TOLERANCIA_SALDO) {
        diferencas.push({
          data,
          caixa,
          saldoMercurio,
          saldoExtrato,
          diferenca: Number((saldoMercurio - saldoExtrato).toFixed(2)),
        });
      }
    } catch {
      // Segue pro próximo dia — ver comentário acima.
    }
  }
  return { diferencas, diasConferidos };
}

// `log(evento)` recebe objetos {tipo, ...} — tipos possíveis: 'status',
// 'aviso', 'transacao_inicio' ({transacao, acao}), 'transacao_fim'
// ({resultado: 'lancado'|'pulado'|'erro', motivo?}), 'concluido' ({resultado}).
//
// A confirmação de "quero lançar este lote" é responsabilidade de quem
// chama, ANTES de invocar esta função (uma confirmação só, pro lote
// inteiro). NUNCA pausa no meio do lote (pedido explícito do usuário,
// 14/09/2026 — antes pausava esperando confirmação quando achava uma
// duplicata ambígua; isso travava um lote inteiro esperando alguém
// clicar): qualquer problema numa transação individual — duplicata
// ambígua incluída — aborta SÓ aquela transação, registra o motivo, e
// segue pra próxima automaticamente. `resultado.itensComErro` acumula
// `{indice, motivo}` de cada uma que não foi lançada por erro (não conta
// "pulado" por dia travado ou duplicata de alta confiança — esses são
// decisões corretas, não falhas) — é essa lista que alimenta "rodar de
// novo só os que falharam" (ver `apenasIndices` abaixo e a tela web).
//
// `apenasIndices` (opcional, array de índices dentro de `plano`): quando
// informado, processa SÓ os itens nessas posições — usado pra reexecutar
// só os que deram erro numa rodada anterior, sem duplicar quem já foi
// lançado com sucesso. Os índices são posições ESTÁVEIS em `plano`
// (mesmo extrato = mesma ordem sempre), então continuam válidos mesmo
// que o usuário tenha corrigido/criado uma regra entre uma rodada e outra
// (quem chama regenera o plano fresco a partir de regras.json antes de
// passar pra cá — ver /api/lancar em web/servidor.js).
//
// `prazo` (opcional, timestamp em ms): na Vercel a função tem um tempo
// máximo e é encerrada sem aviso ao estourar — podendo cortar um lançamento
// no meio. Passado o prazo, nenhuma transação NOVA é iniciada: as que
// faltam entram em `itensComErro` com um motivo claro, e o botão "Rodar
// novamente só os que falharam" continua de onde parou.
const MOTIVO_PRAZO = 'Não processada: o tempo máximo desta rodada no servidor acabou antes de chegar nela. Use "Rodar novamente só os que falharam" para continuar.';

// Em qual caixa (e com qual direção) a transação entra no Mercúrio.
// Quase sempre é o caixa do extrato, na mesma direção do extrato. A
// exceção é a transferência entre caixas, que sempre é lançada a partir do
// caixa de ORIGEM (a tela do Mercúrio fixa a origem = caixa do dia aberto):
//   - saída do extrato (ex: saque do banco pro caixa em dinheiro): origem =
//     caixa do extrato, destino = o outro caixa da regra;
//   - entrada no extrato (ex: depósito do dinheiro do caixa no banco):
//     origem = o outro caixa da regra, destino = caixa do extrato.
// Em ambos os casos, no dia da origem a transferência aparece como SAÍDA —
// é isso que a checagem de duplicata procura (transacaoNoDia).
function ondeLancar(item, caixaPadrao, env) {
  const t = item.transacao;
  const caixaExtrato = resolverCaixa(t, caixaPadrao, env);
  if (!item.acao || item.acao.tela !== 'transferencia') {
    return { caixaDia: caixaExtrato, caixaExtrato, transacaoNoDia: t };
  }
  const outro = item.acao.caixaOutro;
  if (!outro) throw new Error('A regra de transferência não tem o outro caixa definido.');
  if (outro.trim().toUpperCase() === caixaExtrato.trim().toUpperCase()) {
    throw new Error(`Transferência com origem e destino iguais ("${caixaExtrato}") — confira o caixa da regra.`);
  }
  const saida = t.tipo === 'debito';
  return {
    caixaDia: saida ? caixaExtrato : outro,
    caixaExtrato,
    caixaDestino: saida ? outro : caixaExtrato,
    transacaoNoDia: { ...t, tipo: 'debito' },
  };
}

// "caixa|AAAAMMDD" — ordena o lote por caixa (onde será lançado) e data.
function chaveCaixaDia(item, caixaPadrao, env) {
  const [dia, mes, ano] = item.transacao.data.split('/');
  let caixa = '';
  try { caixa = ondeLancar(item, caixaPadrao, env).caixaDia; } catch { /* erro aparece na hora de lançar */ }
  return `${caixa}|${ano}${mes}${dia}`;
}

function prazoEsgotado(prazo) {
  return Boolean(prazo) && Date.now() > prazo;
}

export async function executarPlano(plano, { headless = true, log, env = process.env, credenciais, filial, caixaPadrao, apenasIndices, prazo } = {}) {
  const faltando = validarEnv(env);
  if (faltando.length) {
    throw new Error(`Variável(is) não definida(s) no .env: ${faltando.join(', ')}. Copie .env.example para .env e preencha.`);
  }
  const { matricula, senha } = resolverCredenciais(credenciais, env);
  const nomeFilial = resolverFilial(filial, env);

  const todosComRegra = plano
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => item.regra);
  // Agrupa por caixa e dia (sort estável — dentro do mesmo dia, mantém a
  // ordem do extrato): transações seguidas no mesmo dia/caixa reaproveitam
  // a tela do dia já aberta, sem voltar ao calendário (ver
  // reaproveitarDiaAberto() em lib/mercurioTesouraria.js). Os índices
  // continuam sendo os do plano original — a tela marca cada linha certa.
  const itensComRegra = (apenasIndices
    ? todosComRegra.filter(({ indice }) => apenasIndices.includes(indice))
    : todosComRegra
  ).sort((a, b) => chaveCaixaDia(a.item, caixaPadrao, env).localeCompare(chaveCaixaDia(b.item, caixaPadrao, env)));
  const resultado = { lancados: 0, pulados: 0, erros: 0, diferencasSaldo: [], itensLancados: [], itensComErro: [] };

  if (itensComRegra.length === 0) {
    log({ tipo: 'aviso', mensagem: 'Nenhuma transação com regra correspondente — nada a lançar. Edite regras.json e rode de novo.' });
    log({ tipo: 'concluido', resultado });
    return resultado;
  }

  log({ tipo: 'status', mensagem: 'Entrando no Mercúrio...' });
  const { browser, page } = await abrirNavegador({ headless });

  // "data|caixa" -> {data, caixa, saldoExtrato} — só entra aqui quando o
  // extrato trouxe saldo pra aquele dia (coluna "saldo" do CSV); alimenta
  // conciliarSaldos() no fim. Guarda sempre o ÚLTIMO saldo visto pra cada
  // dia (assume o extrato em ordem cronológica, como é o normal de um
  // extrato bancário) — é o saldo de FECHAMENTO daquele dia que interessa
  // pra comparar com o Saldo do Mercúrio.
  const saldosExtratoPorDia = new Map();

  try {
    await login(page, matricula, senha);
    await abrirTesourariaDaFilial(page, nomeFilial);
    log({ tipo: 'status', mensagem: `Entrou na Tesouraria de "${nomeFilial}".` });

    // Dia/caixa cuja tela está aberta agora (ou null se não dá pra saber —
    // depois de qualquer erro, a página pode ter ficado em outro lugar).
    let diaAberto = null;

    for (const { item, indice } of itensComRegra) {
      const { transacao: t, acao } = item;
      if (prazoEsgotado(prazo)) {
        log({ tipo: 'transacao_fim', indice, resultado: 'erro', motivo: MOTIVO_PRAZO });
        resultado.erros++;
        resultado.itensComErro.push({ indice, motivo: MOTIVO_PRAZO });
        continue;
      }
      log({ tipo: 'transacao_inicio', indice, transacao: t, acao });

      try {
        const { caixaDia, caixaExtrato: caixa, caixaDestino, transacaoNoDia } = ondeLancar(item, caixaPadrao, env);
        let telaDia = null;
        if (diaAberto && diaAberto.data === t.data && diaAberto.caixa === caixaDia) {
          telaDia = await reaproveitarDiaAberto(page, t.data);
        }
        if (!telaDia) telaDia = await abrirDia(page, caixaDia, t.data);
        diaAberto = { data: t.data, caixa: caixaDia };
        const { frame: frameDia, editavel } = telaDia;
        if (!editavel) {
          log({ tipo: 'transacao_fim', indice, resultado: 'pulado', motivo: 'Este dia está fechado/travado no Mercúrio (só leitura). Lance manualmente.' });
          resultado.pulados++;
          continue;
        }

        const existentes = await lerLancamentosExistentes(frameDia);
        const parecidos = acharLancamentosParecidos(existentes, transacaoNoDia);
        if (parecidos.length === 1) {
          log({ tipo: 'transacao_fim', indice, resultado: 'pulado', motivo: 'Já existe um lançamento com o mesmo valor/direção nesse dia (provável duplicata de uma execução anterior).' });
          resultado.pulados++;
          continue;
        }
        if (parecidos.length > 1) {
          const motivo = `${parecidos.length} lançamentos parecidos já existiam nesse dia (ambíguo, não dava pra saber sozinho se algum já é esta transação) — não lançado por segurança. Confira manualmente no Mercúrio e rode de novo se decidir que deve lançar mesmo assim.`;
          log({ tipo: 'transacao_fim', indice, resultado: 'erro', motivo });
          resultado.erros++;
          resultado.itensComErro.push({ indice, motivo });
          continue;
        }

        if (acao.tela === 'recebimento_composto') {
          await lancarRecebimentoComposto(page, frameDia, t, acao);
        } else if (acao.tela === 'transferencia') {
          await lancarTransferencia(page, frameDia, t, caixaDestino);
        } else if (acao.tela === 'pagamento_outros') {
          await lancarPagamentoOutros(page, frameDia, t, acao);
        } else if (acao.tela === 'recebimento_contribuicao') {
          await lancarRecebimentoContribuicao(page, frameDia, t, acao);
        } else if (acao.tela === 'recebimento_avulso' || acao.tela === 'recebimento_inscricao') {
          await lancarRecebimentoAvulsoOuInscricao(page, frameDia, t, acao);
        } else {
          await lancarRecebimentoDoacao(page, frameDia, t, acao);
        }
        log({ tipo: 'transacao_fim', indice, resultado: 'lancado' });
        resultado.lancados++;
        resultado.itensLancados.push({ indice, transacao: t, acao, caixa });
        if (t.saldo !== null && t.saldo !== undefined) {
          saldosExtratoPorDia.set(`${t.data}|${caixa}`, { data: t.data, caixa, saldoExtrato: t.saldo });
        }
      } catch (e) {
        diaAberto = null;
        // sugestaoRecibo: Pix maior que a contribuição — a tela oferece
        // montar um recibo com mais itens (ver lancarRecebimentoContribuicao()).
        const extra = e.sugestaoRecibo ? { sugestaoRecibo: e.sugestaoRecibo } : {};
        log({ tipo: 'transacao_fim', indice, resultado: 'erro', motivo: e.message, ...extra });
        resultado.erros++;
        resultado.itensComErro.push({ indice, motivo: e.message, ...extra });
      }
    }

    if (resultado.lancados > 0 && saldosExtratoPorDia.size > 0 && !prazoEsgotado(prazo)) {
      log({ tipo: 'status', mensagem: 'Conferindo o saldo do Mercúrio contra o extrato...' });
      const { diferencas, diasConferidos } = await conciliarSaldos(page, saldosExtratoPorDia);
      resultado.diferencasSaldo = diferencas;
      if (diferencas.length > 0) {
        const dias = diferencas.map((d) => d.data).join(' e ');
        log({
          tipo: 'conciliacao_saldo',
          diferencas,
          mensagem: `Possível diferença nos dias ${dias}. Verifique e corrija manualmente, ou estorne os lançamentos por segurança.`,
        });
      } else if (diasConferidos > 0) {
        log({ tipo: 'status', mensagem: `Saldo conferido em ${diasConferidos} dia(s) — bate com o Mercúrio.` });
      }
    }
  } finally {
    await browser.close();
  }

  log({ tipo: 'concluido', resultado });
  return resultado;
}

// Passa por cada dia presente no plano e LÊ (nunca grava) os lançamentos já
// existentes no Mercúrio, marcando quais itens do plano parecem já estar
// lançados — pra você decidir ANTES de rodar o lançamento de verdade, sem
// precisar lançar nada pra descobrir. Nunca chama nenhuma
// função de lançar (lancarPagamentoOutros/lancarRecebimentoContribuicao/
// lancarRecebimentoDoacao) — é seguro rodar quantas vezes quiser.
//
// `log(evento)` recebe, além de 'status'/'aviso' (mesmo formato de
// executarPlano): 'verificacao_item' ({indice, parecidos, erro?}) — `indice`
// é a posição do item no array `plano` original, pra quem exibe a tabela
// saber qual linha marcar — e 'verificacao_concluida' ({totalVerificado,
// possiveisDuplicatas}). Verifica TODAS as transações do plano, com ou sem
// regra — saber se algo já está no Mercúrio é útil mesmo pra quem ainda
// vai decidir manualmente o que fazer com ela (não só pras que já seriam
// lançadas automaticamente).
export async function verificarDuplicatas(plano, { headless = true, log, env = process.env, credenciais, filial, caixaPadrao, prazo } = {}) {
  const faltando = validarEnv(env);
  if (faltando.length) {
    throw new Error(`Variável(is) não definida(s) no .env: ${faltando.join(', ')}. Copie .env.example para .env e preencha.`);
  }
  const { matricula, senha } = resolverCredenciais(credenciais, env);
  const nomeFilial = resolverFilial(filial, env);

  const itens = plano.map((item, indice) => ({ item, indice }));

  if (itens.length === 0) {
    log({ tipo: 'aviso', mensagem: 'Nenhuma transação no plano — nada a verificar.' });
    log({ tipo: 'verificacao_concluida', totalVerificado: 0, possiveisDuplicatas: 0 });
    return { totalVerificado: 0, possiveisDuplicatas: 0 };
  }

  // Agrupa por (data + caixa) — não só data, já que agora o caixa pode
  // variar por transação (padrão do lote, ou escolhido linha a linha).
  const porDataECaixa = new Map();
  for (const entrada of itens) {
    // Regra de transferência mal configurada não derruba a verificação
    // inteira — confere no caixa do extrato (o erro aparece ao lançar).
    let caixa;
    try {
      ({ caixaDia: caixa, transacaoNoDia: entrada.transacaoNoDia } = ondeLancar(entrada.item, caixaPadrao, env));
    } catch {
      caixa = resolverCaixa(entrada.item.transacao, caixaPadrao, env);
      entrada.transacaoNoDia = entrada.item.transacao;
    }
    const chave = `${entrada.item.transacao.data}|${caixa}`;
    if (!porDataECaixa.has(chave)) porDataECaixa.set(chave, { data: entrada.item.transacao.data, caixa, entradas: [] });
    porDataECaixa.get(chave).entradas.push(entrada);
  }

  log({ tipo: 'status', mensagem: 'Entrando no Mercúrio (só leitura — nada será lançado)...' });
  const { browser, page } = await abrirNavegador({ headless });
  let possiveisDuplicatas = 0;

  try {
    await login(page, matricula, senha);
    await abrirTesourariaDaFilial(page, nomeFilial);
    log({ tipo: 'status', mensagem: `Entrou na Tesouraria de "${nomeFilial}". Conferindo ${porDataECaixa.size} combinação(ões) de dia/caixa...` });

    for (const { data, caixa, entradas } of porDataECaixa.values()) {
      if (prazoEsgotado(prazo)) {
        for (const { indice } of entradas) {
          log({ tipo: 'verificacao_item', indice, parecidos: [], erro: 'Tempo máximo da rodada no servidor esgotado — clique em "Verificar de novo".' });
        }
        continue;
      }
      try {
        const { frame: frameDia } = await abrirDia(page, caixa, data);
        const existentes = await lerLancamentosExistentes(frameDia);
        for (const { indice, transacaoNoDia } of entradas) {
          const parecidos = acharLancamentosParecidos(existentes, transacaoNoDia);
          if (parecidos.length > 0) possiveisDuplicatas++;
          log({ tipo: 'verificacao_item', indice, parecidos });
        }
      } catch (e) {
        for (const { indice } of entradas) {
          log({ tipo: 'verificacao_item', indice, parecidos: [], erro: e.message });
        }
      }
    }
  } finally {
    await browser.close();
  }

  log({ tipo: 'verificacao_concluida', totalVerificado: itens.length, possiveisDuplicatas });
  return { totalVerificado: itens.length, possiveisDuplicatas };
}
