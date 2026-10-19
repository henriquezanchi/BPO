// Navegação e lançamento dentro de Tesouraria → Caixas do Mercúrio.
//
// Mapeado ao vivo em 12/09/2026 (filial Barra do Garças, caixa BANCO CONTA
// CORRENTE). A parte de Pagamento Outros foi testada olhando a estrutura
// real da tela (sem gravar nada de teste em produção). A parte de
// Recebimento → Contribuições/Doações foi mapeada pela estrutura da tela
// mas os fluxos "Lançar no Recibo -> preencher Interessado -> Finalizar com
// Recibo" NÃO foram testados ponta a ponta (pra não criar recibo/lançamento
// de teste em produção, especialmente porque Contribuições mexe em dados
// reais de um aluno específico) — na primeira vez que usar de verdade, rode
// sem `--confirm` primeiro pra conferir o plano, depois `--verificar` pra
// checar duplicidade, e considere `--visivel` (navegador aparente, em vez
// de headless) se precisar acompanhar de perto o que está acontecendo.
//
// IMPORTANTE: Pix recebidos (créditos) são lançados por Recebimento →
// CONTRIBUIÇÕES (não Doações) — é o fluxo real usado pela tesouraria pra
// mensalidades/contribuições de alunos/membros. Doações é um fluxo à parte,
// mais simples, e continua disponível pra quando você tiver uma regra
// explícita de doação avulsa (ex: doador não cadastrado, sem ficha
// pendente nenhuma) — veja RUBRICAS_DOACAO.md.

import { esperarFrame } from './mercurioAuth.js';
import { validarItensRecibo, formatarValor } from './reciboComposto.js';

// Enviar o recibo por e-mail (Recebimento → Contribuições/Doações/Avulsos/
// Inscrições): ao clicar "Finalizar com Recibo", o Mercúrio abre uma
// JANELA POPUP separada com a tela de impressão do recibo
// (tes_conprt.php), com 2 ícones no canto superior direito — impressora,
// e uma "cartinha" de e-mail que, clicada, abre um prompt() nativo
// "Enviar email para..." (já vem preenchido com o e-mail do OPERADOR
// logado, não do aluno — precisa ser sobrescrito). Mapeado a partir de
// prints reais (14/09/2026), MAS ainda sem o HTML real do ícone/link em
// si (só a posição visual) — por isso fica DESLIGADO por padrão, a
// pedido do usuário ("mantenha o envio de recibo desabilitado para todos
// por enquanto, enquanto estamos testando e não está 100%"). Pra ligar:
// vire esta constante para `true` DEPOIS de confirmar contra o Mercúrio
// real que o seletor do ícone (em enviarReciboPorEmailNoPopup abaixo)
// está certo.
const ENVIO_EMAIL_RECIBO_HABILITADO = false;

// Clica no ícone de e-mail (a "cartinha") na tela de impressão do recibo
// e confirma o prompt() nativo com o endereço informado — só roda se
// ENVIO_EMAIL_RECIBO_HABILITADO for true (ver acima). Melhor esforço:
// qualquer falha aqui nunca derruba o lançamento em si (o recibo já foi
// finalizado de verdade antes disso; só o envio de e-mail é best-effort).
async function enviarReciboPorEmailNoPopup(popup, email) {
  try {
    await popup.waitForLoadState('domcontentloaded', { timeout: 5000 });
    // O prompt() é disparado pelo clique no ícone — registramos o handler
    // ANTES de clicar, com o e-mail certo (sobrescrevendo o padrão que o
    // Mercúrio preenche sozinho, que é o e-mail do operador, não do aluno).
    popup.once('dialog', (dialog) => dialog.accept(email).catch(() => {}));
    // AINDA NÃO CONFIRMADO contra HTML real — só a posição visual (ícone
    // de carta, ao lado do de impressora, canto superior direito). Ajustar
    // este seletor na primeira vez que for ligado de verdade.
    await popup.locator('a[href*="mail" i], img[alt*="mail" i], img[title*="mail" i]').first().click({ timeout: 3000 });
    await popup.waitForTimeout(500);
  } catch {
    // Nunca trava o lançamento por causa do e-mail — ver comentário acima.
  }
}

// Clica em "Finalizar com/sem Recibo" (rótulo depende de acao.emitirRecibo)
// — usado pelas 3 telas de Recebimento (Contribuições/Doações/Avulsos-
// Inscrições; Pagamento Outros não passa por Recibo nenhum, usa "Gravar"
// direto). "Finalizar com Recibo" abre uma janela POPUP separada com a
// tela de impressão (ver comentário acima) — sempre FECHAMOS essa janela
// em seguida (não deixamos acumulando ao longo de um lote headless,
// mesmo com o envio de e-mail desligado), e só tentamos enviar por e-mail
// se ENVIO_EMAIL_RECIBO_HABILITADO for true E a regra tiver
// "acao.emailRecibo" preenchido.
async function finalizarRecibo(page, frame, acao) {
  const nomeBotao = acao.emitirRecibo === false ? 'Finalizar sem Recibo' : 'Finalizar com Recibo';
  const promessaPopup = page.waitForEvent('popup', { timeout: 4000 }).catch(() => null);
  await frame.getByRole('button', { name: nomeBotao }).click().catch(async () => {
    await frame.getByText(nomeBotao, { exact: false }).click();
  });
  const popup = await promessaPopup;
  if (popup) {
    if (ENVIO_EMAIL_RECIBO_HABILITADO && acao.emailRecibo) {
      await enviarReciboPorEmailNoPopup(popup, acao.emailRecibo);
    }
    await popup.close().catch(() => {});
  }
}

async function abrirCaixas(page) {
  const frameIndice = await esperarFrame(page, 'indice', /tes_indice\.php/, 15000);
  await frameIndice.getByText('Caixas', { exact: true }).click();
  return esperarFrame(page, 'principal', /tes_cailivro\.php/, 15000);
}

// Lista os nomes de todos os caixas cadastrados na filial atual (o mesmo
// dropdown "cmbcxa" que irParaCalendario() já usa pra trocar de caixa) —
// usado pra popular o seletor de caixa na tela, em vez de exigir digitar o
// nome exato num .env. Precisa já estar dentro da Tesouraria da filial
// (depois de abrirTesourariaDaFilial()).
export async function listarCaixas(page) {
  const frame = await abrirCaixas(page);
  const opcoes = frame.locator('select[name="cmbcxa"] option');
  const total = await opcoes.count();
  const nomes = [];
  for (let i = 0; i < total; i++) {
    const texto = ((await opcoes.nth(i).textContent()) || '').trim();
    if (texto && !/selecione/i.test(texto)) nomes.push(texto);
  }
  return nomes;
}

// Nome de quem está logado — o rodapé do menu lateral da Tesouraria
// (frame "indice") mostra, segundo print real (10/10/2026), um bloco como
// "BGA 21596 / BARRA DO GARÇAS / LUIZ HENRIQUE ZANCHI": a linha com a
// matrícula, a filial e por último o nome. Pega a última linha não vazia
// depois da que contém a matrícula. Melhor esforço: sem achar, null.
export async function lerNomeUsuario(page, matricula) {
  try {
    const frameIndice = page.frame({ name: 'indice' });
    if (!frameIndice) return null;
    const linhas = (await frameIndice.locator('body').innerText()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const i = linhas.findIndex((l) => l.includes(String(matricula)));
    if (i === -1 || i === linhas.length - 1) return null;
    const nome = linhas[linhas.length - 1];
    return /^[A-ZÀ-Ú][A-ZÀ-Ú .'-]{2,}$/i.test(nome) ? nome : null;
  } catch {
    return null;
  }
}

// Vai até a tela do calendário do caixa certo, no mês/ano da data alvo.
//
// BUG REAL GRAVÍSSIMO corrigido (15/09/2026, relatado pelo usuário: rodar
// um extrato de um mês passado dava "erro ao conferir" em TODO item do
// extrato, sem exceção): mesAtual/anoAtual (lidos dos <input> do calendário
// do Mercúrio) eram comparados como STRING contra mesAlvo/anoAlvo (sempre
// com zero à esquerda, ex: "08", extraído de "DD/MM/AAAA"). Se o Mercúrio
// não preenche esses campos com o mesmo padding (ex: "8" em vez de "08" —
// comum em widget de calendário legado, cujo JS só decrementa um número
// sem repadronizar), "08" === "8" nunca bate, e pior: "08" > "9" (a
// comparação usada pra decidir se avança ou volta o mês) é comparação
// LEXICOGRÁFICA, não numérica, e dá resultado ERRADO ("08" > "9" é FALSO,
// já que '0' < '9' no primeiro caractere) — o código concluía que precisa
// VOLTAR quando na real precisava AVANÇAR (ou vice-versa), girando em
// looping sem nunca convergir até estourar as 24 tentativas e lançar
// "Não consegui chegar em ${data}...". Isso batia certinho no sintoma:
// TODA transação de um extrato de mês anterior precisa da MESMA navegação
// cross-mês (pelo menos 1 clique em "cmdMenos"), então todas quebravam do
// mesmo jeito — enquanto um extrato do mês corrente nunca precisa navegar
// (o calendário já abre nele por padrão), por isso nunca tinha aparecido
// antes. Corrigido comparando tudo como NÚMERO, nunca como texto.
async function irParaCalendario(page, nomeCaixa, dataDDMMAAAA) {
  const [, mesAlvoTexto, anoAlvoTexto] = dataDDMMAAAA.split('/');
  const mesAlvo = Number(mesAlvoTexto);
  const anoAlvo = Number(anoAlvoTexto);
  let frame = await abrirCaixas(page);

  for (let tentativas = 0; tentativas < 24; tentativas++) {
    const mesAtual = Number(await frame.locator('input[name="mes"]').inputValue());
    const anoAtual = Number(await frame.locator('input[name="ano"]').inputValue());
    const opts = await frame.locator('select[name="cmbcxa"] option').allTextContents();
    const caixaAtualTexto = await frame.locator('select[name="cmbcxa"]').evaluate((el) => el.selectedOptions[0]?.textContent.trim());

    const caixaCerto = caixaAtualTexto === nomeCaixa;
    const mesCerto = mesAtual === mesAlvo && anoAtual === anoAlvo;
    if (caixaCerto && mesCerto) return frame;

    if (!caixaCerto) {
      const valorOpt = await frame.locator('select[name="cmbcxa"] option', { hasText: nomeCaixa }).getAttribute('value');
      if (!valorOpt) throw new Error(`Caixa "${nomeCaixa}" não encontrado. Opções disponíveis: ${opts.join(', ')}`);
      await Promise.all([
        frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        frame.locator('select[name="cmbcxa"]').selectOption(valorOpt),
      ]);
      frame = await esperarFrame(page, 'principal', /tes_cailivro\.php/, 15000);
      continue;
    }

    // Navega mês a mês (não achei um jeito de pular direto pro mês/ano —
    // os campos são texto mas o clique em +/- é o que de fato resubmete).
    const alvoMaior = anoAlvo > anoAtual || (anoAlvo === anoAtual && mesAlvo > mesAtual);
    const botao = alvoMaior ? 'cmdMais' : 'cmdMenos';
    await Promise.all([
      frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      frame.locator(`input[name="${botao}"]`).click(),
    ]);
    frame = await esperarFrame(page, 'principal', /tes_cailivro\.php/, 15000);
  }
  throw new Error(`Não consegui chegar em ${dataDDMMAAAA} no calendário do caixa "${nomeCaixa}" (muitas tentativas de navegação de mês).`);
}

// Lê o "Saldo" do dia na tabela do calendário (mesma tela que abrirDia()
// usa pra achar a linha do dia — colunas confirmadas por print real: Id |
// Data | Saldo Anterior | Entradas | Saidas | Saldo | Operação) — usado na
// conferência de saldo pós-lançamento (ver conciliarSaldos() em
// lib/executor.js), pra comparar contra o saldo que o próprio extrato
// trouxe (quando o CSV tem coluna de saldo — ver lib/parsers.js). Só LÊ, nunca clica em nada.
// Devolve null se não achar a linha do dia (dia não existe/ainda não foi
// aberto) ou não conseguir ler um número da célula.
export async function lerSaldoDoDia(page, nomeCaixa, dataDDMMAAAA) {
  const frame = await irParaCalendario(page, nomeCaixa, dataDDMMAAAA);
  const dataComTraco = dataDDMMAAAA.replace(/\//g, '-');
  let linha = frame.locator('tr', { has: frame.locator(`td:text-is("${dataComTraco}")`) });
  let total = await linha.count();
  if (total === 0) {
    linha = frame.locator('tr', { has: frame.locator(`td:text-is("${dataDDMMAAAA}")`) });
    total = await linha.count();
  }
  if (total === 0) return null;

  const celulas = await linha.first().locator('td').allInnerTexts().catch(() => []);
  const textoSaldo = celulas[5] || ''; // 6ª coluna (índice 5): "Saldo"
  const valor = paraNumeroBR(textoSaldo);
  return isNaN(valor) ? null : valor;
}

// Abre (ou cria, se ainda não existir) o registro do dia alvo e devolve o
// frame "principal" já dentro de tes_caifolha.php — junto com um booleano
// dizendo se o dia está editável (mostra a barra Recebimento/Pagamento) ou
// só leitura (dia fechado/trancado, sem como lançar nada nele).
export async function abrirDia(page, nomeCaixa, dataDDMMAAAA) {
  const [dia] = dataDDMMAAAA.split('/');
  let frame = await irParaCalendario(page, nomeCaixa, dataDDMMAAAA);

  // A tabela do calendário escreve a data com TRAÇO (ex: "14-09-2026"), não
  // com barra — confirmado com print real do usuário (14/09/2026). É essa
  // discrepância de formato que causava "Não encontrei a linha do dia" mesmo
  // com o dia certo visível na tela. Tenta com traço primeiro (formato real
  // confirmado) e cai pra barra como reserva, caso algum layout diferente
  // use o outro formato.
  const dataComTraco = dataDDMMAAAA.replace(/\//g, '-');
  let linha = frame.locator('tr', { has: frame.locator(`td:text-is("${dataComTraco}")`) });
  let totalLinhas = await linha.count();
  if (totalLinhas === 0) {
    linha = frame.locator('tr', { has: frame.locator(`td:text-is("${dataDDMMAAAA}")`) });
    totalLinhas = await linha.count();
  }
  if (totalLinhas === 0) throw new Error(`Não encontrei a linha do dia ${dataDDMMAAAA} na tabela do calendário.`);

  // Clica no botão da linha (pode dizer "Abrir" — dia ainda sem lançamento
  // nenhum — ou "Movimento" — dia que já tem algo lançado; os dois levam
  // pra mesma tela de lançamento, tes_caifolha.php, então o resto do fluxo
  // é idêntico independente do texto do botão).
  const botao = linha.first().locator('a, input[type="submit"]').last();
  await Promise.all([
    page.waitForTimeout(50),
    botao.click(),
  ]);
  frame = await esperarFrame(page, 'principal', /tes_caifolha\.php/, 15000);
  await page.waitForTimeout(500);

  return { frame, editavel: await diaEditavel(frame) };
}

async function diaEditavel(frame) {
  return await frame.getByRole('link', { name: 'Pagamento Outros', exact: false }).count() > 0
    || await frame.getByText('Pagamento Outros', { exact: false }).count() > 0;
}

// Reaproveita a tela do dia que JÁ está aberta, sem passar pelo calendário
// de novo — todo lançamento (lancarPagamentoOutros/Contribuicao/Doacao/
// AvulsoOuInscricao) termina de volta em tes_caifolha.php, a tela do mesmo
// dia. Num lote com várias transações no mesmo dia/caixa, isso evita
// reabrir "Caixas", trocar de caixa e voltar mês a mês a cada transação
// (cada clique é uma página nova do Mercúrio — era o grosso do tempo).
// Só vale se a tela ainda for a do dia certo; qualquer dúvida devolve null
// e quem chamou abre o dia do jeito normal (abrirDia).
export async function reaproveitarDiaAberto(page, dataDDMMAAAA) {
  const frame = page.frame({ name: 'principal' });
  if (!frame || !/tes_caifolha\.php/.test(frame.url())) return null;
  await frame.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(300);
  const dataComTraco = dataDDMMAAAA.replace(/\//g, '-');
  const mostraOData = await frame.getByText(dataDDMMAAAA, { exact: false }).count() > 0
    || await frame.getByText(dataComTraco, { exact: false }).count() > 0;
  if (!mostraOData) return null;
  return { frame, editavel: await diaEditavel(frame) };
}

// Lê os lançamentos já existentes no dia (pra checagem de duplicata) —
// melhor esforço: compara valor + direção (entrada/saída), não o texto
// exato da descrição, já que o Mercúrio pode reformatar/categorizar de um
// jeito diferente do texto cru do extrato.
//
// BUG REAL corrigido (15/09/2026, relatado pelo usuário: a checagem nunca
// encontrava um lançamento que comprovadamente já estava lá): a tela
// "REGISTROS DO DIA" (tes_caifolha.php) NÃO é a única <table> da página —
// a barra de botões do topo ("Recebimento | Pagamento à SNE | Pagamento
// Outros | ...") também é uma <table>. Uma 1ª correção tentou achar "a
// tabela certa" pelo cabeçalho "Descrição", mas o usuário confirmou que
// AINDA não funcionava — sem o HTML real da tela em mãos pra confirmar o
// motivo exato (whitespace? aninhamento diferente? o texto vem de outro
// jeito?), trocar a estratégia por uma que NÃO dependa de acertar "qual é
// a tabela certa" é mais seguro: em vez disso, olha TODA LINHA <tr> da
// PÁGINA INTEIRA (não escopado a uma tabela específica) e usa só a FORMA
// da linha pra decidir se é um lançamento de verdade — pula quem não tem
// pelo menos 6 células, e pula quem "parece cabeçalho" (alguma célula com
// o texto exato de um rótulo de coluna conhecido, não mais por POSIÇÃO —
// a barra de botões do topo, coincidentemente, também tem 6 células,
// mas "Voltar"/"Imprimir" nunca viram número, então nunca produzem um
// registro (isNaN já filtra). Índice da descrição: coluna 2 (0 = S, 1 =
// Data, 2 = Descrição, 4 = Entradas, 5 = Saídas — confirmado por print
// real do usuário).
//
// 2º BUG REAL corrigido no mesmo dia (a linha certa já era achada, mas
// AINDA "não encontrava" — confirmado com HTML real do DevTools desta vez,
// não só print): a leitura de Entradas/Saídas usava paraNumeroBR(), que
// assume vírgula decimal e ponto como milhar (padrão do resto do
// Mercúrio) — mas ESTA coluna especificamente renderiza o valor com PONTO
// decimal ("202.69", sem vírgula nenhuma). paraNumeroBR("202.69") apagava
// o ponto (achando que era milhar) e devolvia 20269, nunca batendo com o
// valor do extrato. Trocado por paraNumeroFlexivel(), que decide o
// separador decimal pela POSIÇÃO (o último "," ou "." da string), em vez
// de assumir um formato fixo — cobre os dois estilos que já apareceram
// nesta mesma tela (o valor do lançamento em si, com ponto; os campos de
// Saldo logo abaixo, com vírgula).
export async function lerLancamentosExistentes(frame) {
  const linhas = frame.locator('tr');
  const total = await linhas.count();
  const registros = [];
  for (let i = 0; i < total; i++) {
    const celulas = await linhas.nth(i).locator('td').allInnerTexts();
    if (celulas.length < 6) continue;
    if (celulas.some((c) => /^(Descrição|Entradas|Saídas|Data)$/i.test(c.trim()))) continue; // linha de cabeçalho
    // paraNumeroFlexivel(), não paraNumeroBR() — esta coluna usa PONTO como
    // decimal ("202.69"), diferente do resto do Mercúrio (ver comentário
    // na definição de paraNumeroFlexivel, bug real de 15/09/2026).
    const entradas = paraNumeroFlexivel(celulas[4]);
    const saidas = paraNumeroFlexivel(celulas[5]);
    if (!isNaN(entradas) && entradas > 0) registros.push({ valor: entradas, tipo: 'credito', descricao: celulas[2] || '' });
    if (!isNaN(saidas) && saidas > 0) registros.push({ valor: saidas, tipo: 'debito', descricao: celulas[2] || '' });
  }
  return registros;
}

// Devolve os lançamentos já existentes que "parecem" ser a mesma transação
// (mesmo valor + mesma direção, no mesmo dia) — melhor esforço, por valor,
// não por texto exato (o Mercúrio pode reformatar a descrição). Quem chama
// decide o que fazer com o resultado: 1 candidato = duplicata bem provável
// (pula automaticamente); 2+ candidatos = ambíguo, não dá pra saber sozinho
// qual (se algum) já é esta transação — melhor perguntar do que arriscar.
export function acharLancamentosParecidos(existentes, transacao) {
  return existentes.filter((e) => e.tipo === transacao.tipo && Math.abs(e.valor - transacao.valor) < 0.005);
}

export function jaExisteLancamentoParecido(existentes, transacao) {
  return acharLancamentosParecidos(existentes, transacao).length > 0;
}

// --- Pagamento Outros ------------------------------------------------

export async function lancarPagamentoOutros(page, frameDia, transacao, acao) {
  await frameDia.getByRole('link', { name: 'Pagamento Outros', exact: false }).click().catch(async () => {
    await frameDia.getByText('Pagamento Outros', { exact: false }).click();
  });
  const frame = await esperarFrame(page, 'principal', /tes_pagaout\.php/, 15000);

  await frame.locator('select[name="cmbrub"]').selectOption(String(acao.rubricaId));
  if (acao.descricao) await frame.locator('input[name="txtdesc"]').fill(acao.descricao);
  if (acao.fornecedorId) await frame.locator('select[name="cmbfor"]').selectOption(String(acao.fornecedorId));
  if (acao.interessado) await frame.locator('input[name="txtinter"]').fill(acao.interessado);
  if (acao.complemento) await frame.locator('input[name="txtcomp"]').fill(acao.complemento);
  await frame.locator('input[name="txtvalor"]').fill(String(transacao.valor).replace('.', ','));

  await frame.locator('input[name="cmdGravar"]').click();
  await esperarFrame(page, 'principal', /tes_caifolha\.php/, 15000);
}

// --- Transferência entre caixas ----------------------------------------
// Mapeado a partir de prints reais com o HTML do DevTools (10/10/2026):
// na tela do dia, o botão "Transferência" (a.bota → tes_caixfer.php) abre
// "TRANSFERÊNCIA ENTRE CAIXAS" — Data e Caixa Origem já vêm fixos (são o
// dia e o caixa abertos), Caixa Destino é o select "cmbdst", Valor é o
// input "txtval" (vem "0,00"), Número (cheque/documento) é opcional, e
// "Efetivar Transferência" é o submit "cmdGravar". Ainda não testado ao
// vivo de ponta a ponta — se algo quebrar, a mensagem de erro diz onde.
//
// Quem chama abre o dia do caixa de ORIGEM (ver ondeLancar() em
// lib/executor.js): uma saída do banco abre o dia do banco; uma entrada no
// banco vinda de outro caixa abre o dia desse outro caixa.
export async function lancarTransferencia(page, frameDia, transacao, caixaDestino) {
  await frameDia.getByRole('link', { name: 'Transferência', exact: false }).click().catch(async () => {
    await frameDia.locator('a[href*="tes_caixfer.php"]').first().click();
  });
  const frame = await esperarFrame(page, 'principal', /tes_caixfer\.php/, 15000);

  const destino = frame.locator('select[name="cmbdst"]');
  const opcoes = (await destino.locator('option').allTextContents()).map((o) => o.trim());
  const alvo = opcoes.find((o) => o === caixaDestino) || opcoes.find((o) => o.toUpperCase() === caixaDestino.trim().toUpperCase());
  if (!alvo) throw new Error(`Caixa destino "${caixaDestino}" não aparece na lista da transferência. Opções: ${opcoes.filter(Boolean).join(', ')}`);
  await destino.selectOption({ label: alvo });

  const campoValor = frame.locator('input[name="txtval"]');
  await campoValor.fill('');
  await campoValor.fill(transacao.valor.toFixed(2).replace('.', ','));

  await frame.locator('input[name="cmdGravar"]').click();
  await esperarFrame(page, 'principal', /tes_caifolha\.php/, 15000);
}

// --- Recebimento → Doações --------------------------------------------
// AVISO: fluxo mapeado pela estrutura da tela, ainda não testado ponta a
// ponta contra o Mercúrio de produção (ver comentário no topo do arquivo).

export async function lancarRecebimentoDoacao(page, frameDia, transacao, acao) {
  await frameDia.getByRole('link', { name: 'Recebimento', exact: false }).click().catch(async () => {
    await frameDia.getByText('Recebimento', { exact: false }).click();
  });
  const frameRecibo = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);

  await frameRecibo.getByText('Doações', { exact: true }).click();
  const frameDoacao = await esperarFrame(page, 'principal', /tes_universal8\.php/, 15000);

  if (acao.matriculaDoador) {
    await frameDoacao.locator('input[name="chkfil"][value="MEM"]').check();
    await frameDoacao.locator('select[name="cmbmatr"]').selectOption(String(acao.matriculaDoador));
  } else {
    await frameDoacao.locator('input[name="chkfil"][value="NAO"]').check();
  }
  await frameDoacao.locator('select[name="cmbrub"]').selectOption(String(acao.rubricaId));
  await frameDoacao.locator('input[name="txtval"]').fill(String(transacao.valor).replace('.', ','));
  await frameDoacao.locator('input[name="cmdGravar"]').click();

  const frameReciboDepois = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
  // Nomes confirmados ao vivo (mesma tela tes_universal.php usada por
  // Contribuições): Interessado = "txtnome", Complemento = "txtcompl".
  if (acao.interessado) await frameReciboDepois.locator('input[name="txtnome"]').fill(acao.interessado).catch(() => {});
  if (acao.complemento) await frameReciboDepois.locator('input[name="txtcompl"]').fill(acao.complemento).catch(() => {});

  await finalizarRecibo(page, frameReciboDepois, acao);
  await esperarFrame(page, 'principal', /tes_caifolha\.php/, 15000);
}

// Ajusta o "Valor Unitário" do (único) item já adicionado no Recibo — tela
// "ALTERA ITEM" (tes_universal0.php), confirmada por print + DevTools reais
// em 14/09/2026: link "Alterar" na tabela do Recibo leva até lá; campo
// "Valor Unitário" = input[name="txtvalu"]; botão (rotulado "Alterar" na
// tela, mas o name do campo continua sendo "cmdGravar", mesmo padrão de
// "Gravar" usado no resto do Mercúrio) confirma e volta pro Recibo. Usado
// sempre que o valor com que o item entrou no Recibo (o que a rubrica já
// tinha cadastrado, muitas vezes 0,00) precisa virar o valor real da
// transação — tanto no fluxo novo de Avulsos/Inscrições quanto no desconto
// de pontualidade de Contribuições (ver lancarRecebimentoContribuicao()).
// Ajusta sempre o ÚLTIMO item da tabela — o que acabou de entrar no
// Recibo. Num recibo de um item só, último = único; num recibo com vários
// itens (lancarRecebimentoComposto), é o item recém-adicionado.
async function ajustarValorItemRecibo(page, frameRecibo, valorDesejado) {
  await frameRecibo.getByRole('link', { name: 'Alterar', exact: true }).last().click().catch(async () => {
    await frameRecibo.getByText('Alterar', { exact: true }).last().click();
  });
  const frameAltera = await esperarFrame(page, 'principal', /tes_universal0\.php/, 15000);
  await frameAltera.locator('input[name="txtvalu"]').fill(String(valorDesejado).replace('.', ','));
  await frameAltera.locator('input[name="cmdGravar"]').click();
  return esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
}

// --- Recebimento → Avulsos / Inscrições ---------------------------------
// Mapeado a partir de prints reais em 14/09/2026 (sem DevTools da lista de
// rubricas em si, só da tela "ALTERA ITEM" que vem depois — ver
// ajustarValorItemRecibo() acima). As duas abas ("Avulsos" e "Inscrições")
// no Recibo (tes_universal.php) têm a MESMA estrutura: uma lista com o
// nome de cada rubrica (link clicável, com "Valor" ao lado — pode já vir
// com um valor padrão cadastrado, ou 0,00 quando não tem) — clicar no NOME
// da rubrica volta pro Recibo com o item já adicionado na tabela.
// Diferente de Pagamento Outros/Doações, aqui NÃO existe um <select> com
// "id" de rubrica — a seleção é sempre pelo NOME EXATO mostrado na lista
// (por isso "acao.rubricaNome" é obrigatório, não "rubricaId"; case e
// acentuação precisam bater exatamente como aparece no Mercúrio).
//
// Independente do valor com que a rubrica já vem cadastrada, SEMPRE
// ajustamos pro valor exato da transação via ajustarValorItemRecibo() —
// aqui não existe "ficha pendente" nenhuma pra conferir contra (diferente
// de Contribuições), então a fonte da verdade do valor é sempre o extrato.
//
// AINDA NÃO CONFIRMADO ao vivo: o nome exato do arquivo PHP da lista de
// rubricas (só temos o TÍTULO da tela nos prints, "PESQUISA RUBRICA"/
// "INSCRIÇÕES") — por isso, depois de clicar na aba, esperamos por TEMPO
// (não por URL) antes de reler o frame "principal", mesmo padrão já usado
// em buscarAlunoPorNome() pra tela intermediária "PESQUISA ALUNO". Se a
// primeira execução real falhar aqui, mande a mensagem de erro exata.
export async function lancarRecebimentoAvulsoOuInscricao(page, frameDia, transacao, acao) {
  if (!acao.rubricaNome) throw new Error('acao.rubricaNome é obrigatório para recebimento_avulso/recebimento_inscricao (nome exato da rubrica, como aparece na lista do Mercúrio).');
  const nomeAba = acao.tela === 'recebimento_inscricao' ? 'Inscrições' : 'Avulsos';

  await frameDia.getByRole('link', { name: 'Recebimento', exact: false }).click().catch(async () => {
    await frameDia.getByText('Recebimento', { exact: false }).click();
  });
  let frame = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);

  await frame.getByText(nomeAba, { exact: true }).click();
  await page.waitForTimeout(800);
  frame = page.frame({ name: 'principal' }) || frame;

  await frame.getByRole('link', { name: acao.rubricaNome, exact: true }).click().catch(async () => {
    await frame.getByText(acao.rubricaNome, { exact: true }).click();
  });
  let frameRecibo = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);

  frameRecibo = await ajustarValorItemRecibo(page, frameRecibo, transacao.valor);

  if (acao.interessado) await frameRecibo.locator('input[name="txtnome"]').fill(acao.interessado).catch(() => {});
  if (acao.complemento) await frameRecibo.locator('input[name="txtcompl"]').fill(acao.complemento).catch(() => {});

  await finalizarRecibo(page, frameRecibo, acao);
  await esperarFrame(page, 'principal', /tes_caifolha\.php/, 15000);
}

// --- Recebimento → Contribuições ----------------------------------------
// Fluxo CONFIRMADO ao vivo em 12/09/2026 (matrícula 52664, Daniel Silva
// Suelo — teste real, desfeito em seguida excluindo o item lançado):
//
//   1. No Recibo (tes_universal.php), o botão "Contribuições" (input
//      type=button, onclick="abrir()") só MOSTRA uma caixa de busca dentro
//      da própria página (um "popup" de CSS, não uma janela nova do
//      navegador) — NÃO navega nada sozinho.
//   2. Preencher input[name="txtmatr"] com a matrícula e clicar
//      input[name="cmdContr"] ("Pesquisar") SUBMETE um form (POST) que
//      navega o frame "principal" inteiro para tes_universal7.php — quando
//      a busca é por matrícula exata, vai direto pra tela de fichas
//      pendentes (não passa por nenhuma lista de resultados pra escolher;
//      isso só aconteceria buscando por nome, que este script não usa).
//   3. tes_universal7.php mostra a tabela FICHAS: um checkbox por mês
//      pendente, name="ckb[N]" com value no formato AAAAMM (ex: "202610"
//      = 10/2026) — muito mais confiável que ler o texto da coluna "Mês".
//   4. Marcar checkbox(es) e clicar input[name="cmdCalcular"] SUBMETE o
//      mesmo form de novo (POST pra tes_universal7.php) e preenche a
//      tabela da direita com Descrição/Refer./Valor + uma linha "Total".
//   5. Clicar input[name="cmdLancar"] ("Lançar no Recibo") volta pro
//      Recibo pai (tes_universal.php) com o item adicionado na tabela
//      (Descrição/Ref./Matr/Qtde/V.Unit/V.Total, com link "Excluir" na
//      coluna Op.) — e o Mercúrio PREENCHE SOZINHO o campo "Interessado"
//      (name="txtnome") com o nome do aluno, então só sobrescrevemos se
//      "acao.interessado" vier explicitamente definido na regra.
//
// Diferente de Doações, aqui o valor não é digitado livremente: ele vem de
// fichas (mensalidades) PENDENTES já cadastradas pra um aluno específico
// (identificado por matrícula — a busca por nome não é confiável, ver
// RUBRICAS_CONTRIBUICAO.md). Regra de seleção do mês, definida pelo
// usuário (14/09/2026): contribuição é sempre paga na ordem em que venceu,
// então o mês escolhido é
//   (a) "mesReferencia", se foi informado explicitamente na regra, OU
//   (b) senão, o mês PENDENTE MAIS ANTIGO — sem tentar somar vários meses
//       nem testar cada mês pra ver qual "bate sozinho" (a versão anterior
//       desta função fazia isso; o usuário pediu algo mais simples e
//       previsível).
// Sempre confere o total calculado contra o valor da transação antes de
// lançar — se não bater, ABORTA e devolve um erro claro (nunca lança
// "quase certo"); trate como SEM REGRA e confira/lance manualmente, ou
// informe "mesReferencia" na regra se o mês certo não for o mais antigo
// (ex: pagamento fora de ordem).
//
// DESCONTO DE PONTUALIDADE (regra do usuário, 14/09/2026): contribuições
// geralmente saem R$10 mais baratas se pagas até o dia 10 do mês — a
// ficha do Mercúrio NUNCA aplica esse desconto sozinha (sempre mostra o
// valor cheio), então uma diferença de até R$10 (o Mercúrio calculando
// MAIS que o extrato), com pagamento feito até o dia 10, é ESPERADA, não
// um erro: lança normalmente com "Lançar no Recibo" (que entra com o
// valor cheio) e depois AJUSTA o item pro valor real pago via
// ajustarValorItemRecibo() (ver função acima, mesma tela "ALTERA ITEM"
// usada por Avulsos/Inscrições). Qualquer diferença MAIOR que R$10, ou
// pagamento depois do dia 10, continua abortando — o desconto de
// pontualidade é a ÚNICA divergência de valor tolerada aqui.
//
// Popup de confirmação nativo ("Finalizar esta Operação e Emitir o
// Recibo?") já é tratado globalmente — ver page.on('dialog', ...) em
// abrirNavegador() (lib/mercurioAuth.js).

const TOLERANCIA_CENTAVOS = 0.005;
const LIMITE_DESCONTO_PONTUALIDADE = 10;
const DIA_LIMITE_DESCONTO_PONTUALIDADE = 10;

// Decide o que fazer quando o valor pago difere da ficha da contribuição
// (pedidos do usuário, 14/09 e 10/10/2026):
//   - igual: lança;
//   - até R$10 MENOR, pago até o dia 10: desconto de pontualidade — lança e
//     ajusta sozinho (regra antiga, mantida);
//   - até R$10 de diferença em qualquer outro caso: só ajusta se já houver
//     confirmação (regra "ajustarParaValorRecebido" criada pelo botão
//     "Ajustar a contribuição", ou item digitado no recibo com vários
//     itens); sem ela, NÃO lança e pergunta (o lote nunca pausa — a
//     pergunta aparece no relatório final);
//   - Pix maior por mais de R$10: oferece "Adicionar mais itens ao recibo";
//   - Pix menor por mais de R$10: aborta.
const LIMITE_AJUSTE_CONTRIBUICAO = 10;

function decidirValorContribuicao({ totalFicha, valorPago, dataPagamento, ajusteConfirmado }) {
  if (isNaN(totalFicha)) return { erro: 'diferenca_grande', diferenca: NaN, podeAjustar: false };
  const diferenca = Math.round((valorPago - totalFicha) * 100) / 100; // > 0: pagou a mais
  if (Math.abs(diferenca) < TOLERANCIA_CENTAVOS) return { ajustar: false };
  const dentroDoLimite = Math.abs(diferenca) <= LIMITE_AJUSTE_CONTRIBUICAO + TOLERANCIA_CENTAVOS;
  const dia = parseInt(String(dataPagamento).split('/')[0], 10);
  const pontualidade = diferenca < 0 && dentroDoLimite && dia <= DIA_LIMITE_DESCONTO_PONTUALIDADE;
  if (pontualidade || (ajusteConfirmado && dentroDoLimite)) return { ajustar: true };
  if (diferenca > 0) return { erro: 'maior', diferenca, podeAjustar: dentroDoLimite };
  if (dentroDoLimite) return { erro: 'menor_ajustavel', diferenca, podeAjustar: true };
  return { erro: 'diferenca_grande', diferenca, podeAjustar: false };
}

function paraNumeroBR(texto) {
  const limpo = String(texto || '').replace(/[^\d,.-]/g, '');
  if (!limpo) return NaN;
  return parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
}

// Parser "flexível": diferente de paraNumeroBR() (que SEMPRE assume vírgula
// como decimal e ponto como separador de milhar), aqui não se sabe de
// antemão qual formato a tela vai usar — BUG REAL confirmado por HTML real
// do usuário (15/09/2026): a coluna Entradas/Saídas de "REGISTROS DO DIA"
// (tes_caifolha.php) mostra os valores com PONTO decimal ("202.69"), ao
// contrário do resto do Mercúrio (ex: os campos de Saldo da mesma tela, que
// usam vírgula, "202,69") — paraNumeroBR("202.69") apagava o ponto por
// achar que era separador de milhar e devolvia 20269, nunca batendo com o
// valor do extrato (202.69) e fazendo a checagem de duplicata sempre "achar"
// que era um lançamento novo. Aqui o separador DECIMAL é sempre o último
// (vírgula OU ponto) que aparece na string — qualquer outro antes dele é
// tratado como separador de milhar e descartado; sem nenhum separador,
// interpreta como inteiro. Cobre "202.69", "202,69", "1.234,56" e
// "1,234.56" corretamente.
function paraNumeroFlexivel(texto) {
  const limpo = String(texto || '').trim();
  if (!limpo) return NaN;
  const posVirgula = limpo.lastIndexOf(',');
  const posPonto = limpo.lastIndexOf('.');
  const posDecimal = Math.max(posVirgula, posPonto);
  if (posDecimal === -1) return parseFloat(limpo.replace(/[^\d-]/g, ''));
  const parteInteira = limpo.slice(0, posDecimal).replace(/[.,]/g, '');
  const parteDecimal = limpo.slice(posDecimal + 1).replace(/[^\d]/g, '');
  return parseFloat(`${parteInteira}.${parteDecimal}`);
}

// value dos checkboxes "ckb[N]" vem no formato AAAAMM (ex: "202610").
function valorCheckboxParaMes(valor) {
  if (!/^\d{6}$/.test(valor)) return null;
  return `${valor.slice(4, 6)}/${valor.slice(0, 4)}`;
}

// Lê a tabela FICHAS da tela tes_universal7.php: um checkbox "ckb[N]" por
// mês pendente, cujo value já contém o mês (não precisa ler texto de tabela).
async function lerFichasPendentes(frame) {
  const checkboxes = frame.locator('input[type="checkbox"][name^="ckb"]');
  const total = await checkboxes.count();
  const fichas = [];
  for (let i = 0; i < total; i++) {
    const checkbox = checkboxes.nth(i);
    const valor = await checkbox.getAttribute('value');
    const mes = valorCheckboxParaMes(valor || '');
    if (!mes) continue;
    fichas.push({ mes, valorCheckbox: valor });
  }
  return fichas;
}

// Marca o mês pedido e devolve o frame atualizado (a página inteira
// recarrega — POST) junto com o valor total calculado.
//
// BUG REAL corrigido (14/09/2026, relatado pelo usuário: total sempre
// R$0,00 no mês mais antigo): cada checkbox já tem
// onclick="document.f1.cmdCalcular.click()" (confirmado por HTML real) —
// MARCAR o checkbox sozinho já dispara "Calcular" e recarrega a página.
// O código antigo clicava em "Calcular" DE NOVO logo em seguida,
// incondicionalmente — uma submissão duplicada: a 2ª batia numa página
// que JÁ TINHA RECARREGADO (checkbox de volta ao padrão, desmarcado),
// então o cálculo sempre saía zerado, sem exceção (não era uma corrida
// esporádica — a tela "recalcular" realmente demora uma fração a mais
// pra recarregar que as outras, como o usuário notou, mas o problema de
// verdade era a submissão dupla em si, não só timing). Corrigido: só
// marca o checkbox e espera a navegação que ELE MESMO dispara, sem clicar
// em "Calcular" separadamente.
async function marcarECalcular(page, frame, fichas, mesesParaMarcar) {
  const fichaAlvo = fichas.find((f) => mesesParaMarcar.includes(f.mes));
  if (!fichaAlvo) throw new Error(`Nenhuma ficha pendente bate com o(s) mês(es) pedido(s): ${mesesParaMarcar.join(', ')}.`);

  const checkbox = frame.locator(`input[type="checkbox"][value="${fichaAlvo.valorCheckbox}"]`);
  if (!(await checkbox.isChecked())) {
    await Promise.all([
      frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      checkbox.setChecked(true),
    ]);
  }
  const frameNovo = await esperarFrame(page, 'principal', /tes_universal7\.php/, 15000);
  const linhaTotal = frameNovo.locator('tr', { hasText: 'Total' }).last();
  const celulas = await linhaTotal.locator('td').allInnerTexts().catch(() => []);
  const valorTexto = celulas[celulas.length - 1] || '';
  return { frame: frameNovo, total: paraNumeroBR(valorTexto) };
}

// Devolve a ficha PENDENTE mais antiga — "valorCheckbox" já vem no formato
// AAAAMM (ex: "202609"), então comparar como STRING/número já dá a ordem
// cronológica certa, sem precisar re-parsear "mes" (MM/AAAA).
function fichaMaisAntiga(fichas) {
  return fichas.reduce((antiga, atual) => (atual.valorCheckbox < antiga.valorCheckbox ? atual : antiga));
}

export async function lancarRecebimentoContribuicao(page, frameDia, transacao, acao) {
  if (!acao.matricula) throw new Error('acao.matricula é obrigatório para recebimento_contribuicao.');

  await frameDia.getByRole('link', { name: 'Recebimento', exact: false }).click().catch(async () => {
    await frameDia.getByText('Recebimento', { exact: false }).click();
  });
  let frame = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);

  // "Contribuições" só mostra a caixinha de busca dentro da mesma página —
  // não navega nada, não abre janela nenhuma.
  await frame.locator('input[value="Contribuições"]').click();
  await frame.locator('input[name="txtmatr"]').fill(String(acao.matricula));
  await Promise.all([
    frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    frame.locator('input[name="cmdContr"]').click(),
  ]);
  frame = await esperarFrame(page, 'principal', /tes_universal7\.php/, 15000);

  // Se a busca por matrícula não achar ninguém, o Mercúrio some com a
  // tabela FICHAS (não há um erro explícito conhecido) — detectamos pela
  // ausência de qualquer checkbox "ckb".
  let fichas = await lerFichasPendentes(frame);
  if (fichas.length === 0) {
    throw new Error(`Matrícula "${acao.matricula}": não encontrei nenhuma ficha PENDENTE (matrícula pode não existir, ou o aluno não tem nada pendente no momento). Confira no Mercúrio.`);
  }

  // Escolhe o mês: "mesReferencia" da regra, se informado, senão o
  // PENDENTE MAIS ANTIGO (pedido do usuário — contribuição é paga na
  // ordem em que venceu, então o mais antigo pendente é, na prática,
  // sempre o que está sendo pago agora; nunca tenta somar/combinar vários
  // meses sozinho).
  let mesEscolhido;
  if (acao.mesReferencia) {
    if (!fichas.some((f) => f.mes === acao.mesReferencia)) {
      throw new Error(`Matrícula "${acao.matricula}": mês "${acao.mesReferencia}" não está entre as fichas PENDENTES (${fichas.map((f) => f.mes).join(', ')}).`);
    }
    mesEscolhido = acao.mesReferencia;
  } else {
    mesEscolhido = fichaMaisAntiga(fichas).mes;
  }

  const resultado = await marcarECalcular(page, frame, fichas, [mesEscolhido]);
  frame = resultado.frame;

  const decisao = decidirValorContribuicao({
    totalFicha: resultado.total,
    valorPago: transacao.valor,
    dataPagamento: transacao.data,
    ajusteConfirmado: acao.ajustarParaValorRecebido === true,
  });
  if (decisao.erro) {
    const v = (n) => n.toFixed(2).replace('.', ',');
    const erro = new Error(decisao.erro === 'maior'
      ? `O Pix (R$ ${v(transacao.valor)}) é maior que a contribuição de ${mesEscolhido} da matrícula ${acao.matricula} (R$ ${v(resultado.total)}) — sobram R$ ${v(decisao.diferenca)}. ${decisao.podeAjustar ? 'Escolha "Ajustar a contribuição" ou "Adicionar mais itens ao recibo".' : 'Use "Adicionar mais itens ao recibo" para lançar o restante no mesmo recibo.'}`
      : decisao.erro === 'menor_ajustavel'
        ? `O Pix (R$ ${v(transacao.valor)}) é R$ ${v(-decisao.diferenca)} menor que a contribuição de ${mesEscolhido} da matrícula ${acao.matricula} (R$ ${v(resultado.total)}), fora do desconto de pontualidade (até o dia ${DIA_LIMITE_DESCONTO_PONTUALIDADE}). Escolha "Ajustar a contribuição" se for para lançar com o valor recebido.`
        : `Matrícula "${acao.matricula}": o mês pendente ${acao.mesReferencia ? 'informado' : 'mais antigo'} (${mesEscolhido}) totaliza ${isNaN(resultado.total) ? '(não consegui ler)' : `R$ ${v(resultado.total)}`}, mas a transação é de R$ ${v(transacao.valor)} — diferença maior que R$ ${LIMITE_AJUSTE_CONTRIBUICAO}. Lançamento abortado por segurança (pode ser pagamento de mais de um mês, valor parcial, ou matrícula errada — confira e lance manualmente, ou informe "mesReferencia" na regra se o mês certo não for o mais antigo).`);
    if (decisao.erro !== 'diferenca_grande') {
      erro.sugestaoRecibo = {
        matricula: String(acao.matricula),
        mesReferencia: mesEscolhido,
        valorContribuicao: resultado.total,
        valorRecebido: transacao.valor,
        podeAjustar: decisao.podeAjustar,
        ...(decisao.erro === 'maior' ? { sobra: decisao.diferenca } : {}),
      };
    }
    throw erro;
  }
  const precisaAjustarValor = decisao.ajustar;

  await Promise.all([
    frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    frame.locator('input[name="cmdLancar"]').click(),
  ]);
  let frameReciboDepois = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);

  if (precisaAjustarValor) {
    frameReciboDepois = await ajustarValorItemRecibo(page, frameReciboDepois, transacao.valor);
  }

  // O Mercúrio já preenche "Interessado" (txtnome) sozinho com o nome do
  // aluno — só sobrescrevemos se a regra pedir explicitamente outra coisa.
  if (acao.interessado) await frameReciboDepois.locator('input[name="txtnome"]').fill(acao.interessado).catch(() => {});
  if (acao.complemento) await frameReciboDepois.locator('input[name="txtcompl"]').fill(acao.complemento).catch(() => {});

  await finalizarRecibo(page, frameReciboDepois, acao);
  await esperarFrame(page, 'principal', /tes_caifolha\.php/, 15000);
}

// --- Leitura do catálogo de rubricas (só leitura, nunca lança nada) -------
// Em vez de confiar numa lista congelada no dia em que foi documentada
// (RUBRICAS_PAGAMENTO.md / RUBRICAS_DOACAO.md), lê o `<select>` real de
// cada tela — o mesmo elemento que lancarPagamentoOutros()/
// lancarRecebimentoDoacao() já usam pra lançar (`select[name="cmbrub"]`) —
// e devolve como {id, nome}[], pra regravar os .md com o catálogo atual.
// NUNCA preenche nem clica em "Gravar"/"Finalizar" — só abre a tela, lê as
// opções do combo, e sai.

async function lerOpcoesRubrica(frame) {
  const opcoes = frame.locator('select[name="cmbrub"] option');
  const total = await opcoes.count();
  const itens = [];
  for (let i = 0; i < total; i++) {
    const opcao = opcoes.nth(i);
    const valor = (await opcao.getAttribute('value')) || '';
    const texto = ((await opcao.textContent()) || '').trim();
    if (!valor || !texto || /selecione/i.test(texto)) continue;
    itens.push({ id: valor, nome: texto });
  }
  return itens;
}

export async function importarRubricasDoMercurio(page, nomeCaixa, dataDDMMAAAA) {
  let { frame: frameDia, editavel } = await abrirDia(page, nomeCaixa, dataDDMMAAAA);
  if (!editavel) {
    throw new Error(`O dia ${dataDDMMAAAA} está fechado/travado no Mercúrio — tente rodar num dia do mês corrente (hoje, de preferência).`);
  }

  await frameDia.getByRole('link', { name: 'Pagamento Outros', exact: false }).click().catch(async () => {
    await frameDia.getByText('Pagamento Outros', { exact: false }).click();
  });
  const framePagamento = await esperarFrame(page, 'principal', /tes_pagaout\.php/, 15000);
  const pagamento = await lerOpcoesRubrica(framePagamento);

  // Reabre o dia do zero antes de ir pra Doações — mais seguro que tentar
  // "voltar" no meio do frameset (mesmo princípio de reentrar do zero já
  // usado em outras partes do projeto, em vez de confiar em navegação
  // incerta pra trás).
  ({ frame: frameDia } = await abrirDia(page, nomeCaixa, dataDDMMAAAA));

  await frameDia.getByRole('link', { name: 'Recebimento', exact: false }).click().catch(async () => {
    await frameDia.getByText('Recebimento', { exact: false }).click();
  });
  const frameRecibo = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
  await frameRecibo.getByText('Doações', { exact: true }).click();
  const frameDoacao = await esperarFrame(page, 'principal', /tes_universal8\.php/, 15000);
  const doacao = await lerOpcoesRubrica(frameDoacao);

  return { pagamento, doacao };
}

// Lê os nomes de rubrica de uma lista tipo "PESQUISA RUBRICA"/"INSCRIÇÕES"
// (Avulsos/Inscrições) — cada rubrica é um link clicável com o próprio
// nome como texto (mesmo elemento que lancarRecebimentoAvulsoOuInscricao()
// clica pra selecionar); ignora os links de UI que não são rubrica
// ("Seleciona", "Fechar"). NUNCA clica em nada, só lê.
async function lerNomesRubricaLista(frame) {
  const links = frame.getByRole('link');
  const total = await links.count();
  const nomes = [];
  for (let i = 0; i < total; i++) {
    const texto = ((await links.nth(i).textContent()) || '').trim();
    if (!texto || /^(seleciona|fechar)$/i.test(texto)) continue;
    nomes.push(texto);
  }
  return nomes;
}

// Lê os catálogos de Avulsos e Inscrições (só nome — essas telas não têm
// "id" nenhum, ver lancarRecebimentoAvulsoOuInscricao()) — alimenta a
// lista de sugestões (datalist) do formulário "Criar regra", pra não
// exigir que o usuário decore/digite o nome exato de memória. Reentra o
// dia do zero entre uma aba e outra (mesmo princípio de
// importarRubricasDoMercurio() acima — mais seguro que "voltar" no meio
// do frameset).
export async function importarRubricasRecebimentoExtra(page, nomeCaixa, dataDDMMAAAA) {
  let { frame: frameDia, editavel } = await abrirDia(page, nomeCaixa, dataDDMMAAAA);
  if (!editavel) {
    throw new Error(`O dia ${dataDDMMAAAA} está fechado/travado no Mercúrio — tente rodar num dia do mês corrente (hoje, de preferência).`);
  }

  await frameDia.getByRole('link', { name: 'Recebimento', exact: false }).click().catch(async () => {
    await frameDia.getByText('Recebimento', { exact: false }).click();
  });
  let frame = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
  await frame.getByText('Avulsos', { exact: true }).click();
  await page.waitForTimeout(800);
  frame = page.frame({ name: 'principal' }) || frame;
  const avulso = await lerNomesRubricaLista(frame);

  ({ frame: frameDia } = await abrirDia(page, nomeCaixa, dataDDMMAAAA));
  await frameDia.getByRole('link', { name: 'Recebimento', exact: false }).click().catch(async () => {
    await frameDia.getByText('Recebimento', { exact: false }).click();
  });
  frame = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
  await frame.getByText('Inscrições', { exact: true }).click();
  await page.waitForTimeout(800);
  frame = page.frame({ name: 'principal' }) || frame;
  const inscricao = await lerNomesRubricaLista(frame);

  return { avulso, inscricao };
}

// --- Buscar aluno/membro por NOME em Contribuições -------------------------
// Ajuda a achar a matrícula na hora de CRIAR uma regra (nunca é usado no
// lançamento automático em si — a regra sempre grava uma matrícula fixa,
// por segurança; ver comentário de lancarRecebimentoContribuicao() acima e
// RUBRICAS_CONTRIBUICAO.md). Mapeado a partir de 3 prints reais enviados
// pelo usuário em 14/09/2026 (busca "elisabete" -> 1 resultado -> tela
// "PESQUISA ALUNO" -> clicar "Seleciona" -> tela de fichas pendentes com
// "Matrícula:37403" no cabeçalho) — é o MESMO campo/botão que a busca por
// matrícula exata já usa (`txtmatr`/`cmdContr`), só que buscar por nome faz
// o Mercúrio passar por essa tela de resultados no meio, em vez de ir
// direto pras fichas pendentes.
//
// SUPERSEDIDA por buscarAlunoPorNomeViaFichas() logo abaixo (caminho mais
// rápido indicado pelo usuário em 14/09/2026: a lista de Fichas de
// Contribuições já mostra nome+matrícula lado a lado, sem precisar abrir
// dia/caixa nenhum) — mantida só de referência/fallback, ninguém mais
// chama esta função no servidor web hoje.
export async function buscarAlunoPorNome(page, frameDia, nomeBusca) {
  await frameDia.getByRole('link', { name: 'Recebimento', exact: false }).click().catch(async () => {
    await frameDia.getByText('Recebimento', { exact: false }).click();
  });
  let frame = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);

  await frame.locator('input[value="Contribuições"]').click();
  await frame.locator('input[name="txtmatr"]').fill(nomeBusca);
  await Promise.all([
    frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    frame.locator('input[name="cmdContr"]').click(),
  ]);

  // Buscar por NOME (diferente de matrícula exata) faz o Mercúrio mostrar
  // uma tela intermediária "PESQUISA ALUNO" com 0, 1 ou mais resultados —
  // não sei o nome exato do arquivo PHP dela, então só dou um tempo pra
  // navegar e releio o frame "principal" atual (em vez de esperar por uma
  // URL específica, como o resto do código faz pras telas já confirmadas).
  await page.waitForTimeout(800);
  frame = page.frame({ name: 'principal' }) || frame;

  const linhasResultado = frame.locator('tr').filter({ hasText: 'Seleciona' });
  const total = await linhasResultado.count();

  if (total === 0) {
    return { encontrado: false, motivo: 'nao_encontrado', candidatos: [] };
  }

  const candidatos = [];
  for (let i = 0; i < total; i++) {
    const celulas = await linhasResultado.nth(i).locator('td').allInnerTexts();
    candidatos.push({
      descricao: (celulas[1] || '').trim(),
      cpf: (celulas[2] || '').trim(),
      situacao: (celulas[3] || '').trim(),
      unidade: (celulas[4] || '').trim(),
    });
  }

  if (total > 1) {
    // Ambíguo — nunca escolhe sozinho (mesmo princípio de
    // lancarRecebimentoContribuicao() nunca adivinhar mês). Quem chama
    // decide o que fazer com a lista de candidatos (ex: mostrar na tela
    // pra escolher, ou pedir matrícula manual).
    return { encontrado: false, motivo: 'ambiguo', candidatos };
  }

  await Promise.all([
    frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    linhasResultado.first().getByText('Seleciona', { exact: true }).click(),
  ]);
  await page.waitForTimeout(500);
  const frameFichas = page.frame({ name: 'principal' }) || frame;

  const textoPagina = await frameFichas.locator('body').innerText().catch(() => '');
  const m = textoPagina.match(/Matr[íi]cula\s*:?\s*(\d+)/i);
  if (!m) {
    return { encontrado: false, motivo: 'matricula_nao_lida', candidatos };
  }
  return { encontrado: true, matricula: m[1], nomeConfirmado: candidatos[0].descricao };
}

function normalizarNomeBusca(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

// Caminho MAIS RÁPIDO pra achar a matrícula de um aluno pelo NOME, indicado
// pelo usuário em 14/09/2026 (3 prints reais): Tesouraria → Cadastro →
// "Fichas" (tes_conficha.php) já abre "FICHAS DE CONTRIBUIÇÕES" listando
// TODOS os alunos ativos, nome ao lado de um link "Fichas" cujo próprio
// href já carrega a matrícula (`tes_condeta.php?matr=52948&ano=...&cmb=ATI`)
// — não precisa nem abrir dia/caixa nenhum, nem passar pela tela
// intermediária "PESQUISA ALUNO" de buscarAlunoPorNome() acima. Não muda
// nenhum filtro da tela (fica com o padrão "Por Nome"/"TODOS ATIVOS" já
// selecionado ao entrar) — só lê a tabela que já vem pronta.
export async function buscarAlunoPorNomeViaFichas(page, nomeBusca) {
  const frameIndice = await esperarFrame(page, 'indice', /tes_indice\.php/, 15000);
  await frameIndice.getByText('Fichas', { exact: true }).click();
  const frame = await esperarFrame(page, 'principal', /tes_conficha\.php/, 15000);

  // Só conta como "linha de aluno" quem tem o link "Fichas" que leva pra
  // tes_condeta.php (evita cabeçalho/rodapé da tabela e qualquer outra
  // tabela de layout da página).
  const linhas = frame.locator('tr').filter({ has: frame.locator('a[href*="tes_condeta.php"]') });
  const total = await linhas.count();
  const alvo = normalizarNomeBusca(nomeBusca);

  const candidatos = [];
  for (let i = 0; i < total; i++) {
    const linha = linhas.nth(i);
    const nomeCelula = ((await linha.locator('td').nth(2).innerText().catch(() => '')) || '').trim();
    if (!nomeCelula || !normalizarNomeBusca(nomeCelula).includes(alvo)) continue;
    const href = await linha.locator('a[href*="tes_condeta.php"]').first().getAttribute('href');
    const m = href && href.match(/matr=(\d+)/);
    if (m) candidatos.push({ nome: nomeCelula, matricula: m[1] });
  }

  if (candidatos.length === 0) return { encontrado: false, motivo: 'nao_encontrado', candidatos: [] };
  if (candidatos.length > 1) {
    // Ambíguo — mesmo princípio de sempre, nunca escolhe sozinho.
    return { encontrado: false, motivo: 'ambiguo', candidatos };
  }
  return { encontrado: true, matricula: candidatos[0].matricula, nomeConfirmado: candidatos[0].nome };
}

// --- Recebimento com VÁRIOS itens num recibo só ---------------------------
// Pedido do usuário (10/10/2026, print real de um recibo com 2 contribuições
// + LANCHONETE somando o valor de um único Pix). Abre o Recibo UMA vez e
// adiciona cada item com os mesmos passos já mapeados acima (Contribuições
// por matrícula + mês, Avulsos/Inscrições pelo nome da rubrica, Doações
// pelo combo), confere o "Total" do Recibo contra o Pix e só então
// finaliza. Se qualquer item falhar (ou o total não bater), exclui o que já
// tinha entrado e cancela o Recibo — nunca deixa um recibo pela metade.
// Ainda não testado ao vivo de ponta a ponta.

// `mesesUsados`: meses já colocados neste recibo, por matrícula — a ficha
// continua aparecendo como pendente até o recibo ser finalizado, então é
// aqui que se evita usar o mesmo mês duas vezes.
// Mês de um item de contribuição: o pedido (se houver e estiver pendente)
// ou o pendente mais antigo que ainda não entrou neste recibo. `usados`
// já contém os meses pedidos explicitamente pelos outros itens.
export function escolherMesContribuicao(fichas, mesPedido, usados, matricula) {
  const pendentes = fichas.map((f) => f.mes).join(', ') || 'nenhuma';
  if (mesPedido) {
    if (!fichas.some((f) => f.mes === mesPedido)) {
      throw new Error(`Matrícula ${matricula}: o mês ${mesPedido} não está entre as fichas pendentes (${pendentes}).`);
    }
    return mesPedido;
  }
  const livres = fichas.filter((f) => !usados.has(f.mes)).sort((a, b) => a.valorCheckbox.localeCompare(b.valorCheckbox));
  if (livres.length === 0) {
    throw new Error(`Matrícula ${matricula}: não há mais meses pendentes para este item (pendentes: ${pendentes}).`);
  }
  return livres[0].mes;
}

async function adicionarContribuicaoNoRecibo(page, frameRecibo, dataPagamento, item, mesesUsados) {
  await frameRecibo.locator('input[value="Contribuições"]').click();
  await frameRecibo.locator('input[name="txtmatr"]').fill(String(item.matricula));
  await Promise.all([
    frameRecibo.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    frameRecibo.locator('input[name="cmdContr"]').click(),
  ]);
  let frame = await esperarFrame(page, 'principal', /tes_universal7\.php/, 15000);
  const fichas = await lerFichasPendentes(frame);
  const usados = mesesUsados.get(item.matricula) || new Set();
  const mes = escolherMesContribuicao(fichas, item.mesReferencia, usados, item.matricula);
  usados.add(mes);
  mesesUsados.set(item.matricula, usados);
  item = { ...item, mesReferencia: mes };
  const resultado = await marcarECalcular(page, frame, fichas, [mes]);
  frame = resultado.frame;

  // O valor do item foi digitado pela pessoa no formulário (já é uma
  // confirmação): aceita até R${LIMITE_AJUSTE_CONTRIBUICAO} de diferença
  // para qualquer lado e ajusta o item; mais que isso, aborta.
  const decisao = decidirValorContribuicao({
    totalFicha: resultado.total,
    valorPago: item.valor,
    dataPagamento,
    ajusteConfirmado: true,
  });
  if (decisao.erro) {
    const total = isNaN(resultado.total) ? '(não consegui ler)' : `R$ ${formatarValor(resultado.total)}`;
    throw new Error(`Matrícula ${item.matricula}, mês ${item.mesReferencia}: a ficha totaliza ${total}, mas o item é de R$ ${formatarValor(item.valor)} — diferença maior que R$ ${LIMITE_AJUSTE_CONTRIBUICAO}.`);
  }
  const ajustar = decisao.ajustar;
  await Promise.all([
    frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    frame.locator('input[name="cmdLancar"]').click(),
  ]);
  let recibo = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
  if (ajustar) recibo = await ajustarValorItemRecibo(page, recibo, item.valor);
  return recibo;
}

async function adicionarAvulsoNoRecibo(page, frameRecibo, item) {
  const nomeAba = item.tipo === 'inscricao' ? 'Inscrições' : 'Avulsos';
  await frameRecibo.getByText(nomeAba, { exact: true }).click();
  await page.waitForTimeout(800);
  const frame = page.frame({ name: 'principal' }) || frameRecibo;
  await frame.getByRole('link', { name: item.rubricaNome, exact: true }).click().catch(async () => {
    await frame.getByText(item.rubricaNome, { exact: true }).click();
  });
  const recibo = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
  return ajustarValorItemRecibo(page, recibo, item.valor);
}

async function adicionarDoacaoNoRecibo(page, frameRecibo, item) {
  await frameRecibo.getByText('Doações', { exact: true }).click();
  const frame = await esperarFrame(page, 'principal', /tes_universal8\.php/, 15000);
  await frame.locator('input[name="chkfil"][value="NAO"]').check();
  await frame.locator('select[name="cmbrub"]').selectOption(String(item.rubricaId));
  await frame.locator('input[name="txtval"]').fill(Number(item.valor).toFixed(2).replace('.', ','));
  await frame.locator('input[name="cmdGravar"]').click();
  return esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
}

// "Total" do Recibo (última célula da linha "Total" — print real mostra
// "Total 292,00"; os itens usam ponto decimal, por isso o parser flexível).
async function lerTotalRecibo(frameRecibo) {
  const linha = frameRecibo.locator('tr', { hasText: 'Total' }).last();
  const celulas = await linha.locator('td').allInnerTexts().catch(() => []);
  return paraNumeroFlexivel(celulas[celulas.length - 1] || '');
}

// Best-effort: volta pro Recibo se estiver numa tela intermediária, exclui
// cada item já adicionado (link "Excluir" — confirm() é aceito sozinho, ver
// abrirNavegador()) e clica em "Cancelar/Voltar". Devolve true se conseguiu.
async function desfazerRecibo(page) {
  try {
    let frame = page.frame({ name: 'principal' });
    if (frame && !/tes_universal\.php/.test(frame.url())) {
      await frame.getByRole('button', { name: /Voltar/i }).first().click({ timeout: 3000 }).catch(() => {});
      frame = await esperarFrame(page, 'principal', /tes_universal\.php/, 8000).catch(() => null);
    }
    if (!frame) return false;
    for (let i = 0; i < 20; i++) {
      const excluir = frame.getByRole('link', { name: 'Excluir', exact: true });
      if ((await excluir.count()) === 0) break;
      await Promise.all([
        frame.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {}),
        excluir.first().click(),
      ]);
      frame = await esperarFrame(page, 'principal', /tes_universal\.php/, 10000);
    }
    await frame.getByRole('button', { name: /Cancelar/i }).first().click({ timeout: 3000 }).catch(async () => {
      await frame.getByText(/Cancelar/i).first().click({ timeout: 3000 });
    });
    await esperarFrame(page, 'principal', /tes_caifolha\.php/, 10000);
    return true;
  } catch {
    return false;
  }
}

export async function lancarRecebimentoComposto(page, frameDia, transacao, acao) {
  validarItensRecibo(acao, transacao.valor);

  await frameDia.getByRole('link', { name: 'Recebimento', exact: false }).click().catch(async () => {
    await frameDia.getByText('Recebimento', { exact: false }).click();
  });
  let recibo = await esperarFrame(page, 'principal', /tes_universal\.php/, 15000);
  // Meses informados à mão ficam reservados desde o início — um item sem
  // mês nunca "rouba" o mês que outro item pediu explicitamente.
  const mesesUsados = new Map();
  for (const item of acao.itens) {
    if (item.tipo === 'contribuicao' && item.mesReferencia) {
      if (!mesesUsados.has(item.matricula)) mesesUsados.set(item.matricula, new Set());
      mesesUsados.get(item.matricula).add(item.mesReferencia);
    }
  }

  try {
    for (const [i, item] of acao.itens.entries()) {
      try {
        if (item.tipo === 'contribuicao') {
          recibo = await adicionarContribuicaoNoRecibo(page, recibo, transacao.data, item, mesesUsados);
        }
        else if (item.tipo === 'doacao') recibo = await adicionarDoacaoNoRecibo(page, recibo, item);
        else recibo = await adicionarAvulsoNoRecibo(page, recibo, item);
      } catch (e) {
        throw new Error(`Item ${i + 1}: ${e.message}`);
      }
    }
    const total = await lerTotalRecibo(recibo);
    if (isNaN(total) || Math.abs(total - transacao.valor) >= TOLERANCIA_CENTAVOS) {
      throw new Error(`o total do recibo no Mercúrio (${isNaN(total) ? 'não consegui ler' : `R$ ${formatarValor(total)}`}) não bate com o Pix (R$ ${formatarValor(transacao.valor)}).`);
    }
  } catch (e) {
    const desfeito = await desfazerRecibo(page);
    throw new Error(`Recibo com vários itens não lançado — ${e.message} ${desfeito
      ? 'Os itens já adicionados foram excluídos e o recibo cancelado.'
      : 'ATENÇÃO: não consegui cancelar sozinho o recibo em andamento — confira no Mercúrio e exclua os itens que ficaram pendentes.'}`);
  }

  if (acao.interessado) await recibo.locator('input[name="txtnome"]').fill(acao.interessado).catch(() => {});
  if (acao.complemento) await recibo.locator('input[name="txtcompl"]').fill(acao.complemento).catch(() => {});
  await finalizarRecibo(page, recibo, acao);
  await esperarFrame(page, 'principal', /tes_caifolha\.php/, 15000);
}

// --- Composição das contribuições (lista de ativos com o valor de cada um)
// Tela "EDITAR COMPOSIÇÃO DAS CONTRIBUIÇÕES" (tes_concomp.php), aberta pelo
// link "Composição" do menu lateral (frame "indice") — prints reais com
// HTML do DevTools (11/10/2026). Abre já em "TODOS ATIVOS"; cada linha da
// tabela: Nº | Matr. | Nome (link tes_conedit.php) | Nível | Turma | FFVV |
// Valor ("80,00") | Função. Só lê — nunca clica em "Editar Composição".
export async function lerComposicaoContribuicoes(page) {
  const frameIndice = await esperarFrame(page, 'indice', /tes_indice\.php/, 15000);
  await frameIndice.locator('a[href*="tes_concomp.php"]').first().click().catch(async () => {
    await frameIndice.getByText('Composição', { exact: true }).first().click();
  });
  const frame = await esperarFrame(page, 'principal', /tes_concomp\.php/, 20000);
  await frame.waitForLoadState('domcontentloaded').catch(() => {});
  const linhas = await frame.evaluate(() => [...document.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\s+/g, ' ').trim())));
  const alunos = [];
  for (const c of linhas) {
    if (c.length < 7 || !/^\d+$/.test(c[1] || '')) continue;
    const valor = paraNumeroBR(c[6]);
    alunos.push({
      matricula: c[1],
      nome: c[2],
      nivel: c[3],
      turma: c[4],
      valor: Number.isFinite(valor) ? valor : null,
    });
  }
  if (alunos.length === 0) throw new Error('Não encontrei nenhum aluno na tela de Composição das contribuições — o layout pode ter mudado.');
  return alunos;
}
