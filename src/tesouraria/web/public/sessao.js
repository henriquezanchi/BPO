/* eslint-disable -- script da tela da Tesouraria (código original, roda direto no navegador) */
// Salvamento da sessão no navegador (pedido do usuário, 10/10/2026): se o
// sistema cair, a aba fechar ou a pessoa precisar sair um pouco, ao voltar
// ela continua de onde parou — extrato, filial/caixa, caixas trocados por
// linha, resultado da verificação de duplicidade e o que já foi lançado.
// Um lançamento que estava em andamento é retomado (o servidor continua o
// lote sozinho e guarda o andamento por 24h).
//
// Fica no localStorage DESTE navegador — nunca vai pro servidor. A senha do
// Mercúrio NUNCA entra aqui. Salva sozinho a cada 30s quando algo mudou,
// em cada evento importante e ao fechar a página; o botão "Salvar agora"
// força na hora.
//
// Roda depois de app.js e usa dele: arquivoAtual, planoAtual,
// caixasDisponiveis, caixasPorIndiceOverride, verificacaoPorIndice,
// verificacaoCompleta, matriculasEncontradasPorIndice, renderizarPlano,
// acompanharLancamento, atualizarTodosSelectsCaixaLinha,
// atualizarRubricasEmSegundoPlano, escaparHtml e os elementos da tela.

const CHAVE_SESSAO = 'tesourariaSessaoSalva:v1';
const VALIDADE_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
const INTERVALO_SALVAR_MS = 30 * 1000;
// Lançamento em andamento só é retomado se a sessão for recente — depois
// disso o servidor já terminou (ou descartou) o lote há muito tempo.
const JANELA_RETOMAR_LANCAMENTO_MS = 30 * 60 * 1000;

let sessaoAlterada = false;
let sessaoSalvaEm = null;
let jobLancamentoAtivo = null;
let lancadosNaSessao = []; // índices do plano já lançados nesta sessão
let verificadoEm = null;
let ultimoLancamentoEm = null;

const statusSessao = document.getElementById('statusSessao');
const btnSalvarSessao = document.getElementById('btnSalvarSessao');
const avisoSessaoSalva = document.getElementById('avisoSessaoSalva');
const textoSessaoSalva = document.getElementById('textoSessaoSalva');

function horaCurta(ms) {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dataHoraCurta(ms) {
  const d = new Date(ms);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? `hoje às ${horaCurta(ms)}` : `${d.toLocaleDateString('pt-BR')} às ${horaCurta(ms)}`;
}

function lerSessaoSalva() {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return null;
    const s = JSON.parse(bruto);
    if (!s || !s.arquivo || Date.now() - s.salvaEm > VALIDADE_SESSAO_MS) return null;
    return s;
  } catch {
    return null;
  }
}

function descartarSessaoSalva() {
  try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* sem storage */ }
}

function atualizarStatusSessao(texto, tipo) {
  if (!statusSessao) return;
  statusSessao.textContent = texto;
  statusSessao.className = `status-sessao${tipo ? ` status-sessao-${tipo}` : ''}`;
}

// Monta e grava a fotografia da sessão. Sem extrato carregado, não há o
// que salvar (e não apaga uma sessão anterior ainda não restaurada).
function salvarSessao({ manual = false } = {}) {
  if (!arquivoAtual) {
    if (manual) atualizarStatusSessao('Nada para salvar ainda — escolha um extrato primeiro.', 'aviso');
    return false;
  }
  const foto = {
    salvaEm: Date.now(),
    matricula: inputMatricula.value.trim() || null,
    filial: selectFilial.value || null,
    caixaPadrao: selectCaixaPadrao.value || null,
    caixasDisponiveis,
    arquivo: arquivoAtual,
    caixasPorIndiceOverride,
    matriculasEncontradasPorIndice,
    verificacaoPorIndice,
    verificacaoCompleta,
    verificadoEm,
    lancadosNaSessao,
    ultimoLancamentoEm,
    jobLancamentoAtivo,
    totalTransacoes: planoAtual ? planoAtual.length : null,
  };
  try {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(foto));
  } catch (e) {
    atualizarStatusSessao('Não consegui salvar a sessão neste navegador (armazenamento cheio ou bloqueado). Seu trabalho continua na tela, mas não ficará guardado se a página fechar.', 'erro');
    return false;
  }
  sessaoAlterada = false;
  sessaoSalvaEm = foto.salvaEm;
  atualizarStatusSessao(`Sessão salva neste navegador às ${horaCurta(foto.salvaEm)}.${manual ? '' : ' (automático)'}`, 'ok');
  return true;
}

function marcarSessaoAlterada() {
  sessaoAlterada = true;
  if (sessaoSalvaEm) atualizarStatusSessao(`Alterações ainda não salvas (último salvamento às ${horaCurta(sessaoSalvaEm)}).`, 'aviso');
}

// Ganchos chamados por app.js nos momentos importantes — cada um já salva
// na hora (não espera os 30s), porque são exatamente os momentos em que
// perder o estado custa caro.
function sessaoNovoExtrato() {
  // Extrato novo substitui a sessão salva anterior — o aviso de restaurar
  // não faz mais sentido.
  if (avisoSessaoSalva) avisoSessaoSalva.hidden = true;
  lancadosNaSessao = [];
  verificadoEm = null;
  ultimoLancamentoEm = null;
  jobLancamentoAtivo = null;
  marcarSessaoAlterada();
}

function sessaoVerificacaoConcluida() {
  verificadoEm = Date.now();
  salvarSessao();
}

function sessaoLancamentoIniciado(jobId) {
  jobLancamentoAtivo = jobId;
  ultimoLancamentoEm = Date.now();
  salvarSessao();
}

function sessaoTransacaoLancada(indice) {
  if (!lancadosNaSessao.includes(indice)) lancadosNaSessao.push(indice);
  ultimoLancamentoEm = Date.now();
  salvarSessao();
}

function sessaoLancamentoTerminou() {
  jobLancamentoAtivo = null;
  salvarSessao();
}

setInterval(() => {
  if (sessaoAlterada) salvarSessao();
}, INTERVALO_SALVAR_MS);

if (btnSalvarSessao) btnSalvarSessao.addEventListener('click', () => salvarSessao({ manual: true }));

window.addEventListener('beforeunload', (e) => {
  if (arquivoAtual) salvarSessao();
  // Fechar a página não para o lote (ele roda no servidor), mas a pessoa
  // deixa de acompanhar — o navegador pede confirmação.
  if (jobLancamentoAtivo) {
    e.preventDefault();
    e.returnValue = 'Há um lançamento em andamento. Ele continua no servidor, e ao voltar você retoma o acompanhamento.';
  }
});

// --- Restaurar -----------------------------------------------------------------

function oferecerRestauracao() {
  // Já começou a trabalhar nesta aba: o que está salvo é esta mesma sessão.
  if (arquivoAtual) return;
  const s = lerSessaoSalva();
  if (!s || !avisoSessaoSalva) return;
  // Sessão de outra matrícula (computador compartilhado): não oferece.
  const matriculaAtual = inputMatricula.value.trim();
  if (s.matricula && matriculaAtual && s.matricula !== matriculaAtual) return;

  const partes = [`extrato <strong>${escaparHtml(s.arquivo.nomeArquivo)}</strong>`];
  if (s.totalTransacoes) partes.push(`${s.totalTransacoes} transações`);
  if (s.lancadosNaSessao && s.lancadosNaSessao.length) partes.push(`<strong>${s.lancadosNaSessao.length} já lançada(s) no Mercúrio</strong>`);
  let extra = '';
  if (s.jobLancamentoAtivo) {
    extra = Date.now() - s.salvaEm < JANELA_RETOMAR_LANCAMENTO_MS
      ? ' Um lançamento estava em andamento — ao restaurar, você volta a acompanhá-lo.'
      : ' Um lançamento estava em andamento quando a sessão foi salva — confira no Mercúrio o que entrou.';
  }
  textoSessaoSalva.innerHTML = `Encontrei uma sessão salva ${dataHoraCurta(s.salvaEm)}: ${partes.join(', ')}.${extra}`;
  avisoSessaoSalva.hidden = false;
}

async function restaurarSessao() {
  const s = lerSessaoSalva();
  avisoSessaoSalva.hidden = true;
  if (!s) return;

  // Filial e caixa — sem disparar os "change" (que listariam tudo de novo).
  if (s.filial) {
    if (![...selectFilial.options].some((o) => o.value === s.filial)) {
      selectFilial.insertAdjacentHTML('beforeend', `<option value="${escaparHtml(s.filial)}">${escaparHtml(s.filial)}</option>`);
    }
    selectFilial.value = s.filial;
    selectFilial.disabled = false;
    blocoCaixaPadrao.hidden = false;
  }
  if (s.caixasDisponiveis && s.caixasDisponiveis.length) {
    caixasDisponiveis = s.caixasDisponiveis;
    selectCaixaPadrao.innerHTML = '<option value="">— escolha —</option>'
      + caixasDisponiveis.map((c) => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join('');
    selectCaixaPadrao.disabled = false;
  }
  if (s.caixaPadrao) selectCaixaPadrao.value = s.caixaPadrao;
  if (selectFilial.value && selectCaixaPadrao.value) cartaoUpload.hidden = false;

  arquivoAtual = s.arquivo;
  textoArquivo.innerHTML = `Selecionado: <strong>${escaparHtml(s.arquivo.nomeArquivo)}</strong> (sessão restaurada)`;
  btnGerarPlano.disabled = false;
  caixasPorIndiceOverride = s.caixasPorIndiceOverride || {};
  matriculasEncontradasPorIndice = s.matriculasEncontradasPorIndice || {};
  lancadosNaSessao = s.lancadosNaSessao || [];
  ultimoLancamentoEm = s.ultimoLancamentoEm || null;
  verificadoEm = s.verificadoEm || null;
  verificacaoPorIndice = s.verificacaoPorIndice || {};
  // Se algo foi lançado DEPOIS da última verificação, o resultado dela já
  // não reflete o Mercúrio — verifica de novo (evita lançar em dobro).
  const verificacaoAindaVale = Boolean(s.verificacaoCompleta && s.verificadoEm
    && !(s.ultimoLancamentoEm && s.ultimoLancamentoEm > s.verificadoEm));
  // Com um lançamento para retomar, NÃO dispara a verificação agora: as
  // duas usam o mesmo acompanhamento ao vivo, e o lote em si já confere
  // duplicata transação por transação. Mostra as marcas salvas e pede para
  // verificar de novo quando o lote terminar.
  const retomarLancamento = Boolean(s.jobLancamentoAtivo && Date.now() - s.salvaEm < JANELA_RETOMAR_LANCAMENTO_MS);
  const reaproveitar = verificacaoAindaVale || retomarLancamento;
  verificacaoCompleta = reaproveitar;

  statusUpload.textContent = 'Restaurando a sessão — aplicando as regras de novo...';
  try {
    const resp = await fetch('/economia/tesouraria/api/plano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arquivoAtual),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao montar o plano.');
    planoAtual = dados.plano;
    renderizarPlano(dados.plano, dados.resumo, { reaproveitarVerificacao: reaproveitar });
    recolherEtapaAcesso();
    recolherEtapaExtrato();
    if (retomarLancamento && !verificacaoAindaVale) {
      statusVerificar.textContent = 'há um lançamento em andamento — quando ele terminar, clique em "Verificar de novo" para atualizar a coluna.';
    }
    statusUpload.textContent = lancadosNaSessao.length
      ? `Sessão restaurada. Atenção: ${lancadosNaSessao.length} transação(ões) já foram lançadas no Mercúrio nesta sessão — confira a coluna "Já está no Mercúrio?" antes de lançar de novo.`
      : 'Sessão restaurada.';
  } catch (e) {
    statusUpload.textContent = `Não consegui restaurar o plano: ${e.message}. O extrato continua selecionado — clique em "Gerar plano".`;
  }

  if (retomarLancamento) {
    jobLancamentoAtivo = s.jobLancamentoAtivo;
    cartaoLancar.hidden = false;
    btnLancar.disabled = true;
    painelAndamento.hidden = false;
    logAndamento.innerHTML = '';
    resumoFinal.hidden = true;
    adicionarLinhaLog('status', 'Retomando o acompanhamento do lançamento que estava em andamento...');
    acompanharLancamento(s.jobLancamentoAtivo);
  }

  salvarSessao();
  atualizarRubricasEmSegundoPlano();
}

document.getElementById('btnRestaurarSessao')?.addEventListener('click', restaurarSessao);
document.getElementById('btnDescartarSessao')?.addEventListener('click', () => {
  if (!confirm('Descartar a sessão salva? O extrato e o andamento guardados neste navegador serão apagados (o que já foi lançado no Mercúrio continua lá).')) return;
  descartarSessaoSalva();
  avisoSessaoSalva.hidden = true;
});

// Oferece a restauração quando a tela já sabe quem está logado (online, a
// matrícula vem da tela de entrar logo no início).
setTimeout(oferecerRestauracao, 600);
