/* eslint-disable -- script da tela da Tesouraria (código original, roda direto no navegador) */
// Lógica da tela de revisão — sem framework nenhum, só fetch + DOM.
// 5 etapas, NESTA ORDEM (pedido do usuário — login/filial/caixa antes de
// mexer com o extrato): acesso ao Mercúrio (login individual + escolher
// filial + escolher caixa) -> escolher arquivo (só libera depois da
// etapa anterior) -> gerar/revisar plano -> (opcional) verificar
// duplicidade (só leitura) -> (opcional) lançar de verdade, acompanhando
// tudo por Server-Sent Events. O navegador do Mercúrio em si roda
// invisível (headless) — nunca aparece na tela.

// Atualização automática das rubricas em segundo plano (ver
// atualizarRubricasEmSegundoPlano()) — enquanto ela roda, o servidor está
// com a trava de "uma operação no Mercúrio por vez"; qualquer outra ação
// que use o Mercúrio espera ela terminar em vez de levar um "operação em
// andamento" (ex: a verificação de duplicidade que dispara sozinha logo
// depois de escolher o extrato).
let promessaRubricasSegundoPlano = null;
const ROTAS_QUE_USAM_O_MERCURIO = [
  '/economia/tesouraria/api/filiais/listar',
  '/economia/tesouraria/api/caixas/listar',
  '/economia/tesouraria/api/aluno/buscar',
  '/economia/tesouraria/api/alunos/buscar-lote',
  '/economia/tesouraria/api/verificar',
  '/economia/tesouraria/api/lancar',
  '/economia/tesouraria/api/rubricas/atualizar',
];

// Versão online (Vercel): sessão da senha da equipe expirou → volta pra
// tela de entrar em vez de mostrar um erro solto.
const fetchOriginal = window.fetch.bind(window);
//
// Se o servidor responder 409 (outra operação SUA no Mercúrio ainda está
// rodando — ex: a verificação de duplicidade), espera e tenta de novo
// sozinho por até 3 minutos, em vez de mostrar erro: quem chamou continua
// mostrando o próprio "Buscando..." e começa assim que der.
const ESPERA_OCUPADO_MS = 3000;
const LIMITE_ESPERA_OCUPADO_MS = 3 * 60 * 1000;
window.fetch = async (recurso, opcoes) => {
  const usaMercurio = ROTAS_QUE_USAM_O_MERCURIO.includes(recurso);
  if (promessaRubricasSegundoPlano && usaMercurio) {
    await promessaRubricasSegundoPlano;
  }
  const inicio = Date.now();
  let resp = await fetchOriginal(recurso, opcoes);
  while (usaMercurio && resp.status === 409 && Date.now() - inicio < LIMITE_ESPERA_OCUPADO_MS) {
    await new Promise((r) => setTimeout(r, ESPERA_OCUPADO_MS));
    resp = await fetchOriginal(recurso, opcoes);
  }
  if (resp.status === 401) window.location.href = '/economia/tesouraria/entrar';
  return resp;
};

// Acompanha um job por SSE — mesma interface de um EventSource (onmessage,
// onerror, close), mas reconecta sozinho se a conexão cair: na Vercel a
// função do stream tem tempo máximo e pode ser encerrada no meio de um lote
// longo. Cada reconexão pede só os eventos que ainda não chegaram
// (?desde=N), então nada é repetido. `onerror` só é chamado depois de
// várias tentativas sem sucesso.
function abrirStreamJob(jobId) {
  let fonte = null;
  let recebidos = 0;
  let tentativas = 0;
  let fechado = false;
  const alvo = {
    onmessage: null,
    onerror: null,
    close() {
      fechado = true;
      if (fonte) fonte.close();
    },
  };
  function conectar() {
    fonte = new EventSource(`/economia/tesouraria/api/job/${jobId}/stream?desde=${recebidos}`);
    fonte.onmessage = (msg) => {
      tentativas = 0;
      recebidos = Number(msg.lastEventId) || recebidos + 1;
      if (alvo.onmessage) alvo.onmessage(msg);
    };
    fonte.onerror = () => {
      fonte.close();
      if (fechado) return;
      if (tentativas++ < 8) {
        setTimeout(() => { if (!fechado) conectar(); }, 1500);
        return;
      }
      if (alvo.onerror) alvo.onerror();
    };
  }
  conectar();
  return alvo;
}

const cartaoUpload = document.getElementById('cartaoUpload');
const inputArquivo = document.getElementById('inputArquivo');
const areaArquivo = document.getElementById('areaArquivo');
const textoArquivo = document.getElementById('textoArquivo');
const btnGerarPlano = document.getElementById('btnGerarPlano');
const statusUpload = document.getElementById('statusUpload');

const cartaoPlano = document.getElementById('cartaoPlano');
const resumoPlano = document.getElementById('resumoPlano');
const corpoTabelaPlano = document.getElementById('corpoTabelaPlano');
const textoBuscaLote = document.getElementById('textoBuscaLote');
const acaoBuscaLote = document.getElementById('acaoBuscaLote');
const btnBuscarLote = document.getElementById('btnBuscarLote');
const statusBuscaLote = document.getElementById('statusBuscaLote');

const cartaoLogin = document.getElementById('cartaoLogin');
const inputMatricula = document.getElementById('inputMatricula');
const inputSenha = document.getElementById('inputSenha');
const chkLembrarLogin = document.getElementById('chkLembrarLogin');
const btnMostrarSenha = document.getElementById('btnMostrarSenha');
const selectFilial = document.getElementById('selectFilial');
const btnListarFiliais = document.getElementById('btnListarFiliais');
const statusFiliais = document.getElementById('statusFiliais');
const blocoCaixaPadrao = document.getElementById('blocoCaixaPadrao');
const selectCaixaPadrao = document.getElementById('selectCaixaPadrao');
const btnListarCaixas = document.getElementById('btnListarCaixas');
const statusCaixas = document.getElementById('statusCaixas');

const cartaoVerificar = document.getElementById('cartaoVerificar');
const btnVerificar = document.getElementById('btnVerificar');
const statusVerificar = document.getElementById('statusVerificar');
const logVerificacao = document.getElementById('logVerificacao');

const cartaoLancar = document.getElementById('cartaoLancar');
const btnLancar = document.getElementById('btnLancar');
const painelAndamento = document.getElementById('painelAndamento');
const logAndamento = document.getElementById('logAndamento');
const conciliacaoSaldo = document.getElementById('conciliacaoSaldo');
const resumoFinal = document.getElementById('resumoFinal');
const listaLancamentosRodada = document.getElementById('listaLancamentosRodada');

const modalCriarRegra = document.getElementById('modalCriarRegra');
const modalCriarRegraTitulo = document.getElementById('modalCriarRegraTitulo');
const modalTransacaoPreview = document.getElementById('modalTransacaoPreview');
const regraNome = document.getElementById('regraNome');
const regraContem = document.getElementById('regraContem');
const regraTela = document.getElementById('regraTela');
const regraCamposContribuicao = document.getElementById('regraCamposContribuicao');
const regraCamposPagamento = document.getElementById('regraCamposPagamento');
const regraCamposDoacao = document.getElementById('regraCamposDoacao');
const regraCamposAvulso = document.getElementById('regraCamposAvulso');
const regraRubricaAvulsoNome = document.getElementById('regraRubricaAvulsoNome');
const regraMatricula = document.getElementById('regraMatricula');
const regraMesReferencia = document.getElementById('regraMesReferencia');
const regraRubricaPagamentoBusca = document.getElementById('regraRubricaPagamentoBusca');
const listaRubricasPagamento = document.getElementById('listaRubricasPagamento');
const regraRubricaDoacao = document.getElementById('regraRubricaDoacao');
const regraInteressado = document.getElementById('regraInteressado');
const regraComplemento = document.getElementById('regraComplemento');
const regraInfoValorExato = document.getElementById('regraInfoValorExato');
const blocoValorRegra = document.getElementById('blocoValorRegra');
const regraCamposTransferencia = document.getElementById('regraCamposTransferencia');
const regraCamposComposto = document.getElementById('regraCamposComposto');
const listaItensRecibo = document.getElementById('listaItensRecibo');
const somaItensRecibo = document.getElementById('somaItensRecibo');
const btnAdicionarItemRecibo = document.getElementById('btnAdicionarItemRecibo');
const regraCaixaOutro = document.getElementById('regraCaixaOutro');
const rotuloCaixaOutro = document.getElementById('rotuloCaixaOutro');
const explicacaoTransferencia = document.getElementById('explicacaoTransferencia');
const regraLinhaInteressadoComplemento = document.getElementById('regraLinhaInteressadoComplemento');
const regraValorQualquer = document.getElementById('regraValorQualquer');
const regraValorExato = document.getElementById('regraValorExato');
const textoValorExatoRegra = document.getElementById('textoValorExatoRegra');
const regraOutrasTransacoes = document.getElementById('regraOutrasTransacoes');
const regraLinhaEmitirRecibo = document.getElementById('regraLinhaEmitirRecibo');
const regraEmitirRecibo = document.getElementById('regraEmitirRecibo');
const regraErro = document.getElementById('regraErro');
const btnSalvarRegra = document.getElementById('btnSalvarRegra');
const btnSalvarRegraTexto = document.getElementById('btnSalvarRegraTexto');
const btnExcluirRegra = document.getElementById('btnExcluirRegra');
const btnCancelarRegra = document.getElementById('btnCancelarRegra');
const btnFecharModalRegra = document.getElementById('btnFecharModalRegra');
const regraBuscaNomeAluno = document.getElementById('regraBuscaNomeAluno');
const btnBuscarAluno = document.getElementById('btnBuscarAluno');
const buscaAlunoResultado = document.getElementById('buscaAlunoResultado');
const btnAtualizarRubricasPagamento = document.getElementById('btnAtualizarRubricasPagamento');
const btnAtualizarRubricasDoacao = document.getElementById('btnAtualizarRubricasDoacao');
const btnAtualizarRubricasAvulso = document.getElementById('btnAtualizarRubricasAvulso');
const listaRubricasAvulso = document.getElementById('listaRubricasAvulso');
const listaRubricasInscricao = document.getElementById('listaRubricasInscricao');
const statusAtualizarRubricas = document.getElementById('statusAtualizarRubricas');

const btnAlternarTema = document.getElementById('btnAlternarTema');
const overlayProcessando = document.getElementById('overlayProcessando');
const overlayProcessandoTexto = document.getElementById('overlayProcessandoTexto');

const btnAbrirManual = document.getElementById('btnAbrirManual');
const modalManual = document.getElementById('modalManual');
const btnFecharModalManual = document.getElementById('btnFecharModalManual');
const btnFecharModalManualRodape = document.getElementById('btnFecharModalManualRodape');

let arquivoAtual = null; // { nomeArquivo, conteudo }
let planoAtual = null;
let origemEventos = null;
let rubricasCache = null; // { pagamento: [{id,nome}], doacao: [{id,nome}] }
let indiceRegraEmEdicao = null;
// null = modal está criando uma regra nova; número = está EDITANDO a regra
// já existente nessa posição real de regras.json (item.regraIndice, ver
// serializarPlano() no servidor) — mesmo modal/formulário, só muda o texto
// e o endpoint chamado ao salvar.
let indiceArquivoRegraEmEdicao = null;
// true quando o modal foi aberto por "Somente este lançamento" — a regra
// salva trava por descrição COMPLETA + valor exato, pra nunca generalizar
// pra outra transação parecida (só editar regra nunca usa este modo).
let modoRegraEspecifica = false;
let matriculasEncontradasPorIndice = {}; // indice -> {matricula, nomeConfirmado} (busca em lote)
let caixasDisponiveis = []; // string[] — caixas da filial escolhida
let caixasPorIndiceOverride = {}; // indice -> nomeCaixa (só quando diferente do padrão)

// --- Login individual (matrícula/senha) -------------------------------------
// Nunca é guardado pelo servidor — só o navegador do usuário, e só se ele
// marcar "lembrar" explicitamente. Sem a caixa marcada, os campos ficam
// vazios a cada rodada (tem que digitar de novo).

const CHAVE_LOGIN_SALVO = 'mercurioTesourariaLogin';

function carregarLoginSalvo() {
  try {
    const bruto = localStorage.getItem(CHAVE_LOGIN_SALVO);
    if (!bruto) return;
    const { matricula, senha } = JSON.parse(bruto);
    // Matrícula do Mercúrio é sempre só números — se o valor salvo tiver
    // letra (ex: resíduo de um autofill errado do navegador), não repõe
    // sozinho, pra não perpetuar um valor ruim sem o usuário perceber.
    if (matricula && !/^\d+$/.test(matricula)) {
      localStorage.removeItem(CHAVE_LOGIN_SALVO);
      return;
    }
    inputMatricula.value = matricula || '';
    inputSenha.value = senha || '';
    chkLembrarLogin.checked = true;
  } catch {
    // localStorage indisponível ou dado corrompido — segue sem prefill.
  }
}

function salvarOuLimparLogin() {
  try {
    if (chkLembrarLogin.checked) {
      localStorage.setItem(CHAVE_LOGIN_SALVO, JSON.stringify({ matricula: inputMatricula.value.trim(), senha: inputSenha.value }));
    } else {
      localStorage.removeItem(CHAVE_LOGIN_SALVO);
    }
  } catch {
    // Privado/bloqueado — não é crítico, só não lembra da próxima vez.
  }
}

chkLembrarLogin.addEventListener('change', () => {
  if (!chkLembrarLogin.checked) localStorage.removeItem(CHAVE_LOGIN_SALVO);
  else salvarOuLimparLogin();
});

// Salva a cada edição (não só ao clicar num botão de ação) — se um valor
// errado entrar no campo por qualquer motivo (autofill do navegador,
// digitação errada) e ficar salvo, digitar por cima já corrige o
// localStorage na hora, sem precisar desmarcar/remarcar "lembrar" pra
// limpar o valor antigo.
inputMatricula.addEventListener('input', salvarOuLimparLogin);
inputSenha.addEventListener('input', salvarOuLimparLogin);

// --- Tema claro/escuro -------------------------------------------------
// O tema já foi aplicado o mais cedo possível por um script inline no
// <head> do index.html (evita o "flash" claro->escuro) — aqui só cuida do
// clique no botão e persiste a escolha.

const CHAVE_TEMA = 'mercurio_tesouraria_tema';

function temaAtual() {
  return document.documentElement.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro';
}

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // Privado/bloqueado — só não lembra na próxima visita.
  }
}

btnAlternarTema.addEventListener('click', () => {
  aplicarTema(temaAtual() === 'escuro' ? 'claro' : 'escuro');
});

// --- Manual de uso -------------------------------------------------------
// Botão de "?" no topo, ao lado do de tema — pedido do usuário pra quem
// não é da área de TI conseguir usar a ferramenta sozinho, sem precisar
// perguntar a cada dúvida. Conteúdo é só HTML estático já no index.html
// (modalManual) — não depende de nenhum dado carregado, então pode abrir a
// qualquer momento, mesmo antes de logar.

btnAbrirManual.addEventListener('click', () => {
  modalManual.hidden = false;
});

function fecharModalManual() {
  modalManual.hidden = true;
}

btnFecharModalManual.addEventListener('click', fecharModalManual);
btnFecharModalManualRodape.addEventListener('click', fecharModalManual);
modalManual.addEventListener('click', (e) => {
  if (e.target === modalManual) fecharModalManual();
});

// --- Overlay "processando" (bloqueia a tela) ----------------------------
// Usado pela verificação de duplicidade (agora automática/obrigatória, ver
// Etapa 3) pra deixar bem claro que tem algo rodando no Mercúrio e que
// mexer na tela nesse meio-tempo pode competir com a checagem em curso.

function mostrarOverlayProcessando(texto) {
  overlayProcessandoTexto.textContent = texto;
  overlayProcessando.hidden = false;
}

function esconderOverlayProcessando() {
  overlayProcessando.hidden = true;
}

// "Failed to fetch" é a mensagem genérica que o navegador dá quando o
// request nem chega a sair (servidor fora do ar, sem rede) — bem diferente
// de um erro de aplicação (ex: "Configure o .env antes"), que vem dentro
// de uma resposta HTTP normal. Detectado aqui só pra trocar por uma
// explicação acionável, já que "Failed to fetch" sozinho não diz nada pra
// quem não é programador.
function mensagemErroFetch(e) {
  if (e instanceof TypeError && /failed to fetch/i.test(e.message)) {
    return modoOnline
      ? 'Sem conexão com o servidor. Confira sua internet, recarregue a página (F5) e tente de novo.'
      : 'Não consegui falar com o servidor local — ele pode ter parado. Confira a janela do terminal onde rodou "npm run web" (se fechou ou mostrou algum erro, rode de novo) e tente mais uma vez.';
  }
  return e.message;
}

btnMostrarSenha.addEventListener('click', () => {
  const mostrando = inputSenha.type === 'text';
  inputSenha.type = mostrando ? 'password' : 'text';
  btnMostrarSenha.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
});

carregarLoginSalvo();
iniciarSessao();

// --- Versão online: acesso feito na tela de entrar --------------------------
// A tela /entrar já logou no Mercúrio e conferiu o acesso à Tesouraria
// (ver web/autenticacao.js) e deixou matrícula, senha e filiais no
// sessionStorage desta aba. Aqui elas são usadas direto: os campos de login
// somem, as filiais já aparecem e, com uma filial só, ela vem escolhida e
// os caixas são listados na hora. Localmente (sem tela de entrar), nada
// muda.
const CHAVE_ACESSO = 'tesourariaAcesso';
// true no site online — decide os textos (data-modo no HTML) e as
// mensagens de erro que falam de "servidor local"/terminal.
let modoOnline = false;

function definirModo(online) {
  modoOnline = online;
  document.body.classList.toggle('modo-online', online);
  document.body.classList.toggle('modo-local', !online);
}

async function iniciarSessao() {
  let sessao;
  try {
    const resp = await fetchOriginal('/economia/tesouraria/api/sessao');
    if (resp.status === 401) {
      window.location.href = '/economia/tesouraria/entrar';
      return;
    }
    sessao = await resp.json();
  } catch {
    // Sem resposta do servidor: assume o modo mais conservador nos textos.
    definirModo(location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');
    return;
  }
  definirModo(Boolean(sessao.autenticacao));
  if (!sessao.autenticacao) return;

  let acesso = null;
  try {
    acesso = JSON.parse(sessionStorage.getItem(CHAVE_ACESSO));
  } catch {
    // sessionStorage indisponível — trata como sem acesso.
  }
  // Aba nova (ou sessão de outra matrícula): a senha não está aqui — entrar
  // de novo é o único jeito de tê-la, sem nunca guardá-la no servidor.
  if (!acesso || acesso.matricula !== sessao.matricula) {
    window.location.href = '/economia/tesouraria/sair';
    return;
  }

  inputMatricula.value = acesso.matricula;
  inputSenha.value = acesso.senha;
  chkLembrarLogin.checked = false;
  document.getElementById('blocoLoginManual').hidden = true;
  btnListarFiliais.hidden = true;
  document.getElementById('textoMatriculaConectada').textContent = acesso.matricula;
  if (sessao.nome || acesso.nome) definirNomeUsuario(sessao.nome || acesso.nome);
  document.getElementById('linhaConectado').hidden = false;

  preencherFiliais(acesso.filiais || []);
  blocoCaixaPadrao.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Devolve {matricula, senha} ou null (e já mostra a mensagem de erro no
// lugar indicado) se algum campo estiver vazio.
function obterCredenciais(elementoStatus) {
  const matricula = inputMatricula.value.trim();
  const senha = inputSenha.value;
  if (!matricula || !senha) {
    if (elementoStatus) elementoStatus.textContent = 'Preencha matrícula e senha do Mercúrio (etapa 1) antes de continuar.';
    cartaoLogin.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return null;
  }
  salvarOuLimparLogin();
  return { matricula, senha };
}

// Devolve o nome da filial escolhida, ou null (mostrando erro + rolando
// até o seletor) se ainda não foi escolhida.
function obterFilial(elementoStatus) {
  const filial = selectFilial.value;
  if (!filial) {
    if (elementoStatus) elementoStatus.textContent = 'Escolha a filial (etapa 1) antes de continuar.';
    cartaoLogin.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return null;
  }
  return filial;
}

// --- Filial e caixa ----------------------------------------------------------
// Descobre de verdade (logando no Mercúrio) quais filiais este login tem
// acesso à Tesouraria, e quais caixas existem dentro da filial escolhida —
// em vez de exigir digitar o nome exato num .env. O caixa "padrão" vale
// pro lote inteiro, mas cada linha da tabela do plano pode trocar pra um
// caixa diferente, se precisar.

btnListarFiliais.addEventListener('click', async () => {
  const credenciais = obterCredenciais(statusFiliais);
  if (!credenciais) return;

  btnListarFiliais.disabled = true;
  statusFiliais.textContent = 'Buscando suas filiais no Mercúrio...';
  try {
    const resp = await fetch('/economia/tesouraria/api/filiais/listar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credenciais }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao listar filiais.');
    if (dados.usuario) definirNomeUsuario(dados.usuario);

    preencherFiliais(dados.filiais);
  } catch (e) {
    statusFiliais.textContent = e.message;
  } finally {
    btnListarFiliais.disabled = false;
  }
});

function preencherFiliais(filiais) {
  if (filiais.length === 0) {
    statusFiliais.textContent = 'Nenhuma filial com acesso à Tesouraria encontrada pra essa matrícula.';
    return;
  }
  selectFilial.innerHTML = '<option value="">— escolha —</option>'
    + filiais.map((f) => `<option value="${escaparHtml(f)}">${escaparHtml(f)}</option>`).join('');
  selectFilial.disabled = false;
  statusFiliais.textContent = '';

  // Uma filial só: escolhe sozinho e segue para os caixas. Várias: a
  // última usada neste navegador, se ainda estiver na lista.
  let escolhida = filiais.length === 1 ? filiais[0] : null;
  if (!escolhida) {
    try {
      const ultima = localStorage.getItem(CHAVE_ULTIMA_FILIAL);
      if (ultima && filiais.includes(ultima)) escolhida = ultima;
    } catch { /* sem localStorage */ }
  }
  if (escolhida) {
    selectFilial.value = escolhida;
    selectFilial.dispatchEvent(new Event('change'));
  }
}

const CHAVE_ULTIMA_FILIAL = 'tesourariaUltimaFilial';
selectFilial.addEventListener('change', () => {
  try { if (selectFilial.value) localStorage.setItem(CHAVE_ULTIMA_FILIAL, selectFilial.value); } catch { /* sem localStorage */ }
});

// --- Etapas recolhidas --------------------------------------------------------
// Pedido do usuário (10/10/2026): ao escolher o caixa padrão, a etapa 1
// (acesso) vira uma linha com matrícula, nome e caixa padrão; depois de
// gerar o plano, a etapa 2 (extrato) vira "Extrato importado · Plano
// gerado". Clicar em qualquer ponto da gaveta recolhida abre de novo;
// clicar no título de uma gaveta aberta recolhe.
let nomeUsuarioLogado = null;

function definirNomeUsuario(nome) {
  nomeUsuarioLogado = nome;
  const alvo = document.getElementById('textoNomeConectado');
  if (alvo) alvo.textContent = nome ? ` — ${nome}` : '';
  try {
    const acesso = JSON.parse(sessionStorage.getItem('tesourariaAcesso'));
    if (acesso) sessionStorage.setItem('tesourariaAcesso', JSON.stringify({ ...acesso, nome }));
  } catch { /* sem sessionStorage */ }
  atualizarResumoAcesso();
}

function atualizarResumoAcesso() {
  const alvo = document.getElementById('resumoAcesso');
  if (!alvo) return;
  const partes = [];
  if (inputMatricula.value.trim()) partes.push(`Matrícula <strong>${escaparHtml(inputMatricula.value.trim())}</strong>`);
  if (nomeUsuarioLogado) partes.push(escaparHtml(nomeUsuarioLogado));
  if (selectCaixaPadrao.value) partes.push(`Caixa padrão: <strong>${escaparHtml(selectCaixaPadrao.value)}</strong>`);
  alvo.innerHTML = `<span title="${escaparHtml(selectFilial.value || '')}">${partes.join(' · ')}</span>
    <button type="button" class="botao-link" data-expandir="cartaoLogin">Alterar</button>`;
}

function atualizarResumoExtrato() {
  const alvo = document.getElementById('resumoExtrato');
  if (!alvo) return;
  const total = planoAtual ? ` (${planoAtual.length} transações)` : '';
  alvo.innerHTML = `<span>Extrato importado: <strong>${escaparHtml(arquivoAtual ? arquivoAtual.nomeArquivo : '')}</strong> · Plano de lançamentos gerado${total}</span>
    <button type="button" class="botao-link" data-expandir="cartaoUpload">Trocar extrato</button>`;
}

function recolher(cartao) {
  cartao.dataset.colapsavel = '1';
  cartao.classList.add('colapsado');
}

function recolherEtapaAcesso() {
  if (!selectCaixaPadrao.value) return;
  atualizarResumoAcesso();
  recolher(cartaoLogin);
}

function recolherEtapaExtrato() {
  atualizarResumoExtrato();
  recolher(cartaoUpload);
}

document.addEventListener('click', (e) => {
  const recolhido = e.target.closest('.cartao.colapsado');
  if (recolhido) {
    recolhido.classList.remove('colapsado');
    return;
  }
  const titulo = e.target.closest('.cartao[data-colapsavel] > h2');
  if (titulo) titulo.parentElement.classList.add('colapsado');
});

// Só libera a etapa de escolher o extrato depois de filial E caixa padrão
// escolhidos — o usuário pediu explicitamente essa ordem (login/filial/
// caixa primeiro, importação depois). Uma vez liberado, fica liberado
// (trocar a filial depois não esconde a etapa de novo).
function atualizarDesbloqueioUpload() {
  if (selectFilial.value && selectCaixaPadrao.value) cartaoUpload.hidden = false;
}

selectFilial.addEventListener('change', () => {
  blocoCaixaPadrao.hidden = !selectFilial.value;
  selectCaixaPadrao.innerHTML = '<option value="">Carregando os caixas da filial...</option>';
  selectCaixaPadrao.disabled = true;
  caixasDisponiveis = [];
  atualizarTodosSelectsCaixaLinha();
  // Já busca os caixas sozinho ao escolher a filial — economiza um clique
  // no caso comum (a pessoa provavelmente vai querer ver os caixas logo).
  if (selectFilial.value) listarCaixas();
});

btnListarCaixas.addEventListener('click', () => listarCaixas());

async function listarCaixas() {
  const credenciais = obterCredenciais(statusCaixas);
  if (!credenciais) return;
  const filial = obterFilial(statusCaixas);
  if (!filial) return;

  btnListarCaixas.disabled = true;
  // Guarda a escolha ANTES de trocar o seletor por "Carregando...".
  const caixaAnterior = selectCaixaPadrao.value;
  selectCaixaPadrao.disabled = true;
  selectCaixaPadrao.innerHTML = '<option value="">Carregando os caixas da filial...</option>';
  statusCaixas.textContent = '';
  try {
    const resp = await fetch('/economia/tesouraria/api/caixas/listar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credenciais, filial }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao listar caixas.');
    // Reserva: o nome completo vem da tela de funções (login/filiais); o do
    // rodapé da Tesouraria pode vir cortado.
    if (dados.usuario && !nomeUsuarioLogado) definirNomeUsuario(dados.usuario);

    if (dados.caixas.length === 0) {
      statusCaixas.textContent = 'Nenhum caixa encontrado nessa filial.';
    } else {
      caixasDisponiveis = dados.caixas;
      selectCaixaPadrao.innerHTML = '<option value="">— escolha —</option>'
        + dados.caixas.map((c) => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join('');
      selectCaixaPadrao.disabled = false;
      if (caixaAnterior && dados.caixas.includes(caixaAnterior)) {
        // Caixa que já estava escolhido continua — e a etapa recolhe, como
        // se tivesse sido escolhido agora.
        selectCaixaPadrao.value = caixaAnterior;
        recolherEtapaAcesso();
      } else {
        preSelecionarCaixaDoBanco();
      }
      statusCaixas.textContent = '';
      atualizarTodosSelectsCaixaLinha();
    }
  } catch (e) {
    statusCaixas.textContent = e.message;
  } finally {
    btnListarCaixas.disabled = false;
  }
}

function aoEscolherCaixaPadrao() {
  verificacaoCompleta = false;
  atualizarResumoAcesso();
  atualizarTodosSelectsCaixaLinha();
  atualizarDesbloqueioUpload();
  atualizarRubricasEmSegundoPlano();
  recolherEtapaAcesso();
}
selectCaixaPadrao.addEventListener('change', aoEscolherCaixaPadrao);

// Caixa padrão pré-selecionado (pedido do usuário, 11/10/2026): a
// ferramenta importa extrato BANCÁRIO, então o caixa do banco é o caso
// comum. Procura "BANCO CONTA CORRENTE" (ou, sem ele, o 1º caixa com
// "BANCO" no nome) e avisa que dá para trocar.
function normalizarTexto(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function caixaDoBanco(caixas) {
  return caixas.find((c) => normalizarTexto(c) === 'BANCO CONTA CORRENTE')
    || caixas.find((c) => normalizarTexto(c).includes('BANCO'))
    || null;
}

function preSelecionarCaixaDoBanco() {
  const caixa = caixaDoBanco(caixasDisponiveis);
  if (!caixa) return;
  selectCaixaPadrao.value = caixa;
  aoEscolherCaixaPadrao();
  mostrarAvisoFlutuante(
    `Caixa padrão: <strong>${escaparHtml(caixa)}</strong> — escolhido sozinho porque o extrato é do banco. Dá para trocar aqui, ou só numa transação pela tabela do plano.`,
    { rotuloAcao: 'Trocar caixa', acao: () => { cartaoLogin.classList.remove('colapsado'); selectCaixaPadrao.focus(); } },
  );
}

// Aviso flutuante (canto da tela), some sozinho depois de alguns segundos.
function mostrarAvisoFlutuante(html, { rotuloAcao, acao, duracaoMs = 10000 } = {}) {
  let caixa = document.getElementById('avisoFlutuante');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.id = 'avisoFlutuante';
    caixa.className = 'aviso-flutuante';
    caixa.setAttribute('role', 'status');
    document.body.appendChild(caixa);
  }
  caixa.innerHTML = `<span class="aviso-flutuante-texto">${html}</span>`;
  if (rotuloAcao && acao) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao-secundario';
    botao.textContent = rotuloAcao;
    botao.addEventListener('click', () => { caixa.hidden = true; acao(); });
    caixa.appendChild(botao);
  }
  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.className = 'aviso-flutuante-fechar';
  fechar.setAttribute('aria-label', 'Fechar aviso');
  fechar.textContent = '✕';
  fechar.addEventListener('click', () => { caixa.hidden = true; });
  caixa.appendChild(fechar);
  caixa.hidden = false;
  clearTimeout(caixa._relogio);
  caixa._relogio = setTimeout(() => { caixa.hidden = true; }, duracaoMs);
}

// Monta as opções do seletor de caixa de UMA linha da tabela — sempre tem
// "Usar padrão" (mostrando qual é o padrão atual, se já escolhido) mais
// cada caixa individual, pra trocar só aquela transação específica.
function montarSelectCaixaLinha(indice) {
  if (caixasDisponiveis.length === 0) {
    return `<select class="select-caixa-linha" data-indice="${indice}" disabled><option>padrão do lote</option></select>`;
  }
  const padrao = selectCaixaPadrao.value;
  const rotuloPadrao = padrao ? `Usar padrão (${escaparHtml(padrao)})` : 'Usar padrão';
  const escolhido = caixasPorIndiceOverride[indice] || '';
  const opcoes = [`<option value="">${rotuloPadrao}</option>`]
    .concat(caixasDisponiveis.map((c) => `<option value="${escaparHtml(c)}" ${c === escolhido ? 'selected' : ''}>${escaparHtml(c)}</option>`));
  return `<select class="select-caixa-linha" data-indice="${indice}">${opcoes.join('')}</select>`;
}

function atualizarTodosSelectsCaixaLinha() {
  corpoTabelaPlano.querySelectorAll('.celula-caixa').forEach((celula) => {
    const linha = celula.closest('tr');
    const indice = Number(linha.dataset.indice);
    celula.innerHTML = montarSelectCaixaLinha(indice);
  });
}

corpoTabelaPlano.addEventListener('change', (e) => {
  const select = e.target.closest('.select-caixa-linha');
  if (!select) return;
  const indice = Number(select.dataset.indice);
  if (select.value) caixasPorIndiceOverride[indice] = select.value;
  else delete caixasPorIndiceOverride[indice];
  // A verificação de duplicidade depende do caixa — o resultado guardado
  // deixa de valer (a próxima remontagem do plano verifica de novo).
  verificacaoCompleta = false;
  marcarSessaoAlterada();
});

// --- Etapa 1: escolher arquivo ---------------------------------------------

function lerArquivo(file) {
  if (!file) return;
  const nomeOk = /\.(ofx|csv)$/i.test(file.name);
  if (!nomeOk) {
    statusUpload.textContent = 'Use um arquivo .ofx ou .csv.';
    return;
  }
  const leitor = new FileReader();
  leitor.onload = () => {
    arquivoAtual = { nomeArquivo: file.name, conteudo: leitor.result };
    sessaoNovoExtrato();
    textoArquivo.innerHTML = `Selecionado: <strong>${escaparHtml(file.name)}</strong>`;
    statusUpload.textContent = '';
    btnGerarPlano.disabled = false;
    cartaoPlano.hidden = true;
    cartaoVerificar.hidden = true;
    cartaoLancar.hidden = true;
    // Reseta só o que é ESPECÍFICO deste extrato (índices mudam com um
    // arquivo novo) — login/filial/caixa continuam valendo (é a mesma
    // sessão no Mercúrio, só o extrato trocou).
    matriculasEncontradasPorIndice = {};
    caixasPorIndiceOverride = {};
  };
  leitor.onerror = () => {
    statusUpload.textContent = 'Não consegui ler o arquivo — tente de novo.';
  };
  leitor.readAsText(file, 'utf-8');
}

inputArquivo.addEventListener('change', () => lerArquivo(inputArquivo.files[0]));

['dragover', 'dragenter'].forEach((evento) => {
  areaArquivo.addEventListener(evento, (e) => {
    e.preventDefault();
    areaArquivo.classList.add('arrastando');
  });
});
['dragleave', 'drop'].forEach((evento) => {
  areaArquivo.addEventListener(evento, (e) => {
    e.preventDefault();
    areaArquivo.classList.remove('arrastando');
  });
});
areaArquivo.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  lerArquivo(file);
});

// --- Etapa 2: gerar e mostrar o plano ---------------------------------------

btnGerarPlano.addEventListener('click', async () => {
  if (!arquivoAtual) return;
  btnGerarPlano.disabled = true;
  statusUpload.textContent = 'Lendo extrato e aplicando regras...';
  try {
    const resp = await fetch('/economia/tesouraria/api/plano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arquivoAtual),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao gerar o plano.');
    planoAtual = dados.plano;
    renderizarPlano(dados.plano, dados.resumo);
    statusUpload.textContent = '';
    marcarSessaoAlterada();
    recolherEtapaExtrato();
  } catch (e) {
    statusUpload.textContent = e.message;
  } finally {
    btnGerarPlano.disabled = false;
  }
});

function formatarMoeda(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escaparHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Resultado da última verificação de duplicidade, por índice do plano —
// reaproveitado quando o plano é só remontado por causa de uma regra
// criada/editada/excluída (ver `reaproveitarVerificacao` abaixo).
let verificacaoPorIndice = {};
let verificacaoCompleta = false;

// `reaproveitarVerificacao`: a verificação compara data/valor/caixa de
// TODAS as transações (com ou sem regra) contra o Mercúrio — mexer numa
// regra não muda nenhum resultado dela. Antes, cada regra salva disparava
// a verificação inteira de novo (abrindo o Mercúrio e travando a tela com
// "Processando..."), sem necessidade. Só reaproveita se a última rodada
// chegou ao fim; senão verifica de novo, como sempre.
function renderizarPlano(plano, resumo, { reaproveitarVerificacao = false } = {}) {
  resumoPlano.innerHTML = `
    <div class="resumo-item"><div class="valor">${resumo.total}</div><div class="rotulo">transações lidas</div></div>
    <div class="resumo-item ok"><div class="valor">${resumo.comRegra}</div><div class="rotulo">com regra (prontas p/ lançar)</div></div>
    <div class="resumo-item alerta${resumo.semRegra > 0 ? ' resumo-clicavel' : ''}" ${resumo.semRegra > 0 ? 'role="button" tabindex="0" title="Ir para a primeira transação sem regra" data-ir-para="sem-regra"' : ''}><div class="valor">${resumo.semRegra}</div><div class="rotulo">sem regra (lançar manualmente)</div></div>
  `;

  corpoTabelaPlano.innerHTML = plano.map((item, indice) => {
    const t = item.transacao;
    const sinal = t.tipo === 'credito' ? '+' : '−';
    const classeValor = t.tipo === 'credito' ? 'valor-credito' : 'valor-debito';
    const celulaCaixa = `<td class="celula-caixa">${montarSelectCaixaLinha(indice)}</td>`;
    if (item.temRegra) {
      return `
        <tr data-indice="${indice}">
          <td>${escaparHtml(t.data)}</td>
          <td class="${classeValor}">${sinal} R$ ${formatarMoeda(t.valor)}</td>
          <td>${escaparHtml(t.descricao)}</td>
          <td><span class="badge badge-ok">OK</span></td>
          <td>
            ${escaparHtml(item.nomeTela)}
            <div class="detalhe-acao">${escaparHtml(item.detalhe)}</div>
            <div class="nome-regra">regra: "${escaparHtml(item.nomeRegra)}"</div>
            <button type="button" class="botao-editar-regra" data-indice="${indice}" title="Editar esta regra">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar regra
            </button>
          </td>
          ${celulaCaixa}
          <td class="celula-duplicidade"><span class="badge badge-nao-verificado"><span class="spinner-mini" aria-hidden="true"></span> verificando...</span></td>
        </tr>`;
    }
    return `
      <tr class="linha-sem-regra" data-indice="${indice}">
        <td>${escaparHtml(t.data)}</td>
        <td class="${classeValor}">${sinal} R$ ${formatarMoeda(t.valor)}</td>
        <td>${escaparHtml(t.descricao)}</td>
        <td><span class="badge badge-sem-regra">SEM REGRA</span></td>
        <td>
          <span class="texto-secundario">lance manualmente, ou</span>
          <button type="button" class="botao-criar-regra" data-indice="${indice}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Criar regra
          </button>
          <button type="button" class="botao-link botao-somente-lancamento" data-indice="${indice}" title="Marca o destino só desta transação, sem criar uma regra que valha pra outras parecidas">Somente este lançamento</button>
        </td>
        ${celulaCaixa}
        <td class="celula-duplicidade"><span class="badge badge-nao-verificado"><span class="spinner-mini" aria-hidden="true"></span> verificando...</span></td>
      </tr>`;
  }).join('');

  cartaoPlano.hidden = false;
  cartaoVerificar.hidden = resumo.total === 0;
  cartaoLancar.hidden = resumo.comRegra === 0;
  statusVerificar.textContent = '';
  logVerificacao.hidden = true;
  logVerificacao.innerHTML = '';
  painelAndamento.hidden = true;
  logAndamento.innerHTML = '';
  resumoFinal.hidden = true;

  // Reaplica (não reseta) achados de buscas anteriores — os índices são
  // estáveis entre regenerações do MESMO extrato (ex: depois de criar uma
  // regra), então uma matrícula já encontrada continua valendo.
  for (const [indice, resultado] of Object.entries(matriculasEncontradasPorIndice)) {
    marcarMatriculaEncontradaNaTabela(Number(indice), resultado);
  }

  const totalCreditosSemRegra = plano.filter((i) => !i.temRegra && i.transacao.tipo === 'credito').length;
  textoBuscaLote.hidden = totalCreditosSemRegra === 0;
  acaoBuscaLote.hidden = totalCreditosSemRegra === 0;
  statusBuscaLote.textContent = '';

  // Verificar duplicidade deixou de ser opcional (pedido do usuário) — dispara
  // sozinha aqui, cobrindo tanto a geração inicial do plano quanto qualquer
  // regeneração depois de criar/editar uma regra (as 2 chamadas de
  // renderizarPlano() no arquivo). Login/filial já são exigidos antes de
  // chegar na etapa de upload, então normalmente já estão preenchidos — se
  // por algum motivo não estiverem, executarVerificacaoDuplicidade() já
  // sabe mostrar o erro certo (obterCredenciais()/obterFilial()) em vez de
  // falhar silenciosamente.
  if (resumo.total === 0) return;
  if (reaproveitarVerificacao && verificacaoCompleta) {
    for (const [indice, { parecidos, erro }] of Object.entries(verificacaoPorIndice)) {
      marcarDuplicidadeNaTabela(Number(indice), parecidos, erro);
    }
    statusVerificar.textContent = 'resultado anterior mantido (mudar regras não altera o que já está no Mercúrio).';
    return;
  }
  executarVerificacaoDuplicidade();
}

// Clicar no card "sem regra" rola até a primeira transação sem regra e a
// destaca por um instante.
function irParaPrimeiraSemRegra() {
  const linha = corpoTabelaPlano.querySelector('tr.linha-sem-regra');
  if (!linha) return;
  linha.scrollIntoView({ behavior: 'smooth', block: 'center' });
  linha.classList.remove('linha-destacada');
  void linha.offsetWidth; // reinicia a animação se clicar de novo
  linha.classList.add('linha-destacada');
}
resumoPlano.addEventListener('click', (e) => {
  if (e.target.closest('[data-ir-para="sem-regra"]')) irParaPrimeiraSemRegra();
});
resumoPlano.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-ir-para="sem-regra"]')) {
    e.preventDefault();
    irParaPrimeiraSemRegra();
  }
});

// --- Criar regra a partir de uma transação SEM REGRA ------------------------
// Formulário que grava uma regra nova em regras.json (via POST /api/regras)
// e, ao salvar, reconstrói o plano inteiro (mesmo arquivo, regras.json já
// atualizado) — assim a transação clicada E qualquer outra parecida no
// mesmo extrato já aparecem como "OK" na hora, sem precisar reabrir nada.

corpoTabelaPlano.addEventListener('click', (e) => {
  const botaoCriar = e.target.closest('.botao-criar-regra');
  if (botaoCriar) {
    abrirModalCriarRegra(Number(botaoCriar.dataset.indice)).catch((err) => {
      console.error('Erro ao abrir "Criar regra":', err);
      alert(`Não consegui abrir o formulário de regra: ${err.message}`);
    });
    return;
  }
  const botaoSomente = e.target.closest('.botao-somente-lancamento');
  if (botaoSomente) {
    abrirModalCriarRegra(Number(botaoSomente.dataset.indice), { especifico: true }).catch((err) => {
      console.error('Erro ao abrir "Somente este lançamento":', err);
      alert(`Não consegui abrir o formulário de regra: ${err.message}`);
    });
    return;
  }
  const botaoEditar = e.target.closest('.botao-editar-regra');
  if (botaoEditar) {
    abrirModalEditarRegra(Number(botaoEditar.dataset.indice)).catch((err) => {
      console.error('Erro ao abrir "Editar regra":', err);
      alert(`Não consegui abrir o formulário de regra: ${err.message}`);
    });
  }
});

// --- Buscar matrículas em lote ----------------------------------------------
// Loga uma vez só e busca o nome de TODAS as transações de crédito SEM
// REGRA de uma vez — bem mais rápido que clicar "Buscar" transação por
// transação (cada clique individual reabriria login do zero). Quem achar
// já sai com a regra CRIADA sozinha no servidor (pedido do usuário — antes
// era preciso clicar em "Criar regra (matrícula X encontrada)" linha por
// linha depois da busca); ao terminar, o plano é regenerado e essas linhas
// já aparecem como "OK", sem nenhum clique extra.
btnBuscarLote.addEventListener('click', async () => {
  if (!planoAtual) return;
  const credenciais = obterCredenciais(statusBuscaLote);
  if (!credenciais) return;
  const filial = obterFilial(statusBuscaLote);
  if (!filial) return;

  const lista = planoAtual
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => !item.temRegra && item.transacao.tipo === 'credito')
    .map(({ item, indice }) => ({ indice, nome: sugerirPalavraChave(item.transacao.descricao) }));
  if (lista.length === 0) return;

  btnBuscarLote.disabled = true;
  statusBuscaLote.textContent = `Buscando ${lista.length} nome(s) no Mercúrio...`;

  try {
    const resp = await fetch('/economia/tesouraria/api/alunos/buscar-lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credenciais, lista, filial, caixa: selectCaixaPadrao.value }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao iniciar a busca em lote.');

    const es = abrirStreamJob(dados.jobId);
    es.onmessage = async (msg) => {
      const evento = JSON.parse(msg.data);
      if (evento.tipo === 'status') {
        statusBuscaLote.textContent = evento.mensagem;
      } else if (evento.tipo === 'busca_item') {
        if (evento.resultado.encontrado && !evento.resultado.regraCriada) {
          // Achou a matrícula mas NÃO criou regra nova (já existia uma com
          // essa mesma palavra-chave, ou a criação falhou por algum
          // motivo) — mantém o caminho manual de sempre, com a matrícula
          // já preenchida no botão, pra não perder o achado.
          matriculasEncontradasPorIndice[evento.indice] = evento.resultado;
          marcarMatriculaEncontradaNaTabela(evento.indice, evento.resultado);
        }
      } else if (evento.tipo === 'busca_lote_concluida') {
        // regerarPlanoAposMudarRegras() → renderizarPlano() zera o texto
        // deste status como parte do reset padrão de re-render — por isso
        // regenera o plano PRIMEIRO e só escreve a mensagem final depois,
        // senão "Concluído: ..." desaparecia assim que a tabela atualizava.
        if (evento.regrasCriadas > 0) await regerarPlanoAposMudarRegras();
        const partes = [`${evento.encontrados} de ${evento.total} encontrado(s)`];
        if (evento.regrasCriadas > 0) partes.push(`${evento.regrasCriadas} regra(s) criada(s) automaticamente`);
        statusBuscaLote.textContent = `Concluído: ${partes.join(', ')}.`;
      } else if (evento.tipo === 'erro_fatal') {
        statusBuscaLote.textContent = `Erro: ${evento.mensagem}`;
      } else if (evento.tipo === 'fim_stream') {
        es.close();
        btnBuscarLote.disabled = false;
      }
    };
    es.onerror = () => {
      statusBuscaLote.textContent = 'Conexão com o servidor perdida.';
      es.close();
      btnBuscarLote.disabled = false;
    };
  } catch (e) {
    statusBuscaLote.textContent = e.message;
    btnBuscarLote.disabled = false;
  }
});

function marcarMatriculaEncontradaNaTabela(indice, resultado) {
  const linha = corpoTabelaPlano.querySelector(`tr[data-indice="${indice}"]`);
  if (!linha) return;
  const botao = linha.querySelector('.botao-criar-regra');
  if (botao) {
    botao.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Criar regra (matrícula ${escaparHtml(resultado.matricula)} encontrada)`;
    botao.classList.add('botao-criar-regra-encontrada');
  }
}

// Tenta isolar a parte "identidade" da descrição de um Pix (nome da pessoa
// ou empresa), removendo prefixos comuns do banco ("Transf Pix recebida -
// ") e o CPF/CNPJ que normalmente vem no fim — só uma SUGESTÃO, o usuário
// sempre revisa/edita antes de salvar (nunca decide sozinho).
function sugerirPalavraChave(descricao) {
  let s = (descricao || '').trim();
  s = s.replace(/^transf\.?\s*pix\s*(recebid[ao]|enviad[ao])?\s*(de|para)?\s*-?\s*/i, '');
  s = s.replace(/^pix\s*(recebid[ao]|enviad[ao])?\s*(de|para)?\s*-?\s*/i, '');
  s = s.replace(/\s*-\s*[\d.\/-]{8,}\s*$/, '');
  s = s.replace(/\s*-\s*$/, '').trim();
  return s || descricao.trim();
}

async function carregarRubricasSeNecessario(forcar) {
  if (rubricasCache && !forcar) return rubricasCache;
  const resp = await fetch('/economia/tesouraria/api/rubricas');
  if (!resp.ok) {
    throw new Error(modoOnline
      ? `O servidor respondeu ${resp.status} ao buscar as rubricas — recarregue a página (F5) e tente de novo.`
      : `Servidor respondeu ${resp.status} ao buscar rubricas — se você editou o projeto recentemente, reinicie o "npm run dev".`);
  }
  rubricasCache = await resp.json();
  listaRubricasPagamento.innerHTML = rubricasCache.pagamento
    .map((r) => `<option value="${escaparHtml(r.nome)}" data-id="${r.id}"></option>`)
    .join('');
  regraRubricaDoacao.innerHTML = rubricasCache.doacao
    .map((r) => `<option value="${r.id}">${escaparHtml(r.nome)}</option>`)
    .join('');
  listaRubricasAvulso.innerHTML = (rubricasCache.avulso || [])
    .map((nome) => `<option value="${escaparHtml(nome)}"></option>`)
    .join('');
  listaRubricasInscricao.innerHTML = (rubricasCache.inscricao || [])
    .map((nome) => `<option value="${escaparHtml(nome)}"></option>`)
    .join('');
  return rubricasCache;
}

// --- Atualizar o catálogo de rubricas direto do Mercúrio --------------------
// Loga (mesmas credenciais da etapa 1), relê os 2 combos reais e regrava
// RUBRICAS_PAGAMENTO.md/RUBRICAS_DOACAO.md — pra quando a lista congelada
// na documentação ficar desatualizada. Mesmo padrão de job/SSE do resto do
// app, só que disparado de dentro do modal.
async function atualizarRubricasDoMercurio() {
  const credenciais = obterCredenciais(statusAtualizarRubricas);
  if (!credenciais) return;
  const filial = obterFilial(statusAtualizarRubricas);
  if (!filial) return;

  const botoesAtualizarRubricas = [btnAtualizarRubricasPagamento, btnAtualizarRubricasDoacao, btnAtualizarRubricasAvulso];
  botoesAtualizarRubricas.forEach((b) => { b.disabled = true; });
  statusAtualizarRubricas.hidden = false;

  // A atualização automática já está rodando — não adianta abrir outra,
  // só espera ela terminar (o texto final é escrito por ela).
  if (promessaRubricasSegundoPlano) {
    statusAtualizarRubricas.textContent = 'Já estou atualizando as rubricas em segundo plano — só um instante...';
    await promessaRubricasSegundoPlano;
    botoesAtualizarRubricas.forEach((b) => { b.disabled = false; });
    return;
  }

  statusAtualizarRubricas.textContent = 'Lendo as rubricas no Mercúrio...';

  try {
    const resp = await fetch('/economia/tesouraria/api/rubricas/atualizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credenciais, filial, caixa: selectCaixaPadrao.value }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao iniciar a atualização.');

    const es = abrirStreamJob(dados.jobId);
    es.onmessage = async (msg) => {
      const evento = JSON.parse(msg.data);
      if (evento.tipo === 'status') {
        statusAtualizarRubricas.textContent = evento.mensagem;
      } else if (evento.tipo === 'rubricas_atualizadas') {
        statusAtualizarRubricas.textContent = `Atualizado: ${evento.totalPagamento} rubricas de Pagamento Outros, ${evento.totalDoacao} de Doações, ${evento.totalAvulso} de Avulsos, ${evento.totalInscricao} de Inscrições.`;
        await carregarRubricasSeNecessario(true);
      } else if (evento.tipo === 'erro_fatal') {
        statusAtualizarRubricas.textContent = `Erro: ${evento.mensagem}`;
      } else if (evento.tipo === 'fim_stream') {
        es.close();
        botoesAtualizarRubricas.forEach((b) => { b.disabled = false; });
      }
    };
    es.onerror = () => {
      statusAtualizarRubricas.textContent = 'Conexão com o servidor perdida.';
      es.close();
      botoesAtualizarRubricas.forEach((b) => { b.disabled = false; });
    };
  } catch (e) {
    statusAtualizarRubricas.textContent = e.message;
    botoesAtualizarRubricas.forEach((b) => { b.disabled = false; });
  }
}
// Atualização AUTOMÁTICA, em segundo plano (pedido do usuário: importar as
// rubricas assim que logar no Mercúrio, sem interromper ninguém) — dispara
// quando filial + caixa padrão ficam escolhidos (é o que a leitura do
// catálogo precisa), uma vez por filial/caixa em cada abertura da página.
// Nada de overlay nem aviso grande: só uma linha discreta no status dos
// caixas. Uma falha aqui não atrapalha nada — o catálogo que já estava
// salvo continua valendo, e o link manual segue disponível no formulário.
let rubricasAutoAtualizadasPara = null;

function atualizarRubricasEmSegundoPlano() {
  // A lista de ativos já guardada no servidor vale enquanto a nova leitura
  // não termina.
  carregarComposicao();
  const filial = selectFilial.value;
  const caixa = selectCaixaPadrao.value;
  if (!filial || !caixa || !inputMatricula.value.trim() || !inputSenha.value) return;
  const chave = `${filial}|${caixa}`;
  if (promessaRubricasSegundoPlano || rubricasAutoAtualizadasPara === chave) return;
  rubricasAutoAtualizadasPara = chave;
  const credenciais = obterCredenciais(null);


  promessaRubricasSegundoPlano = (async () => {
    try {
      // fetchOriginal: o fetch "normal" esperaria por esta mesma promessa.
      const pedir = () => fetchOriginal('/economia/tesouraria/api/rubricas/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credenciais, filial, caixa }),
      });
      let resp = await pedir();
      const inicioEspera = Date.now();
      while (resp.status === 409 && Date.now() - inicioEspera < LIMITE_ESPERA_OCUPADO_MS) {
        await new Promise((r) => setTimeout(r, ESPERA_OCUPADO_MS));
        resp = await pedir();
      }
      if (resp.status === 401) {
        window.location.href = '/economia/tesouraria/entrar';
        return;
      }
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || 'Erro ao iniciar a atualização.');

      const evento = await new Promise((resolve) => {
        let resultado = null;
        const es = abrirStreamJob(dados.jobId);
        es.onmessage = (msg) => {
          const e = JSON.parse(msg.data);
          if (e.tipo === 'rubricas_atualizadas' || e.tipo === 'erro_fatal') resultado = e;
          if (e.tipo === 'fim_stream') {
            es.close();
            resolve(resultado);
          }
        };
        es.onerror = () => resolve(null);
      });

      if (evento && evento.tipo === 'rubricas_atualizadas') {
        await carregarRubricasSeNecessario(true);
        carregarComposicao();
        const resumo = `${evento.totalPagamento} de Pagamento Outros, ${evento.totalDoacao} de Doações, ${evento.totalAvulso} de Avulsos, ${evento.totalInscricao} de Inscrições`;
        statusAtualizarRubricas.textContent = `Atualizado: ${resumo}.`;
      } else {
        throw new Error(evento ? evento.mensagem : 'conexão perdida');
      }
    } catch (e) {
      // Deixa tentar de novo na próxima troca de caixa.
      rubricasAutoAtualizadasPara = null;
      console.warn('Atualização automática de rubricas falhou:', e.message);
    } finally {
      promessaRubricasSegundoPlano = null;
    }
  })();
}

btnAtualizarRubricasPagamento.addEventListener('click', atualizarRubricasDoMercurio);
btnAtualizarRubricasDoacao.addEventListener('click', atualizarRubricasDoMercurio);
btnAtualizarRubricasAvulso.addEventListener('click', atualizarRubricasDoMercurio);

// --- Buscar aluno/membro por nome (ajuda a achar a matrícula) --------------
btnBuscarAluno.addEventListener('click', async () => {
  const nome = regraBuscaNomeAluno.value.trim();
  buscaAlunoResultado.hidden = true;
  if (!nome) return;

  const credenciais = obterCredenciais(null);
  if (!credenciais) {
    mostrarResultadoBuscaAluno('erro', 'Preencha matrícula e senha do Mercúrio (etapa 1) antes de buscar.');
    return;
  }
  const filial = obterFilial(null);
  if (!filial) {
    mostrarResultadoBuscaAluno('erro', 'Escolha a filial (etapa 1) antes de buscar.');
    return;
  }

  btnBuscarAluno.disabled = true;
  mostrarResultadoBuscaAluno('aviso', 'Buscando no Mercúrio...');
  try {
    const resp = await fetch('/economia/tesouraria/api/aluno/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credenciais, nome, filial, caixa: selectCaixaPadrao.value }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro na busca.');

    if (dados.encontrado) {
      regraMatricula.value = dados.matricula;
      // Sempre o nome CONFIRMADO pelo Mercúrio, nunca o que estava
      // digitado na busca (pode ter sido só um palpite a partir do
      // extrato) — mesmo princípio do "jaEncontrado" da busca em lote.
      regraInteressado.value = dados.nomeConfirmado;
      mostrarResultadoBuscaAluno('sucesso', `✓ Encontrado: ${dados.nomeConfirmado} — matrícula ${dados.matricula} preenchida abaixo${dados.valorContribuicao ? ` (contribuição R$ ${formatarMoeda(dados.valorContribuicao)})` : ''}.`);
      avaliarPixContribuicao();
    } else if (dados.motivo === 'ambiguo') {
      const lista = dados.candidatos.map((c) => (c.matricula
        ? `<li>${escaparHtml(c.nome)} — matrícula <strong>${escaparHtml(c.matricula)}</strong> — ${escaparHtml(c.turma || '')}${c.valorContribuicao ? ` — contribuição R$ ${formatarMoeda(c.valorContribuicao)}` : ''}</li>`
        : `<li>${escaparHtml(c.descricao)} — CPF ${escaparHtml(c.cpf)} — ${escaparHtml(c.situacao)} — ${escaparHtml(c.unidade)}</li>`)).join('');
      mostrarResultadoBuscaAluno('aviso', `Mais de um resultado, não dá pra saber qual sozinho — confira e digite a matrícula manualmente:<ul>${lista}</ul>`, true);
    } else if (dados.motivo === 'nao_encontrado') {
      mostrarResultadoBuscaAluno('aviso', 'Não encontrei ninguém com esse nome no Mercúrio — digite a matrícula manualmente (pode ser alguém que não é aluno/membro atual).');
    } else {
      mostrarResultadoBuscaAluno('aviso', 'Achei a pessoa, mas não consegui ler a matrícula na tela — digite manualmente.');
    }
  } catch (e) {
    mostrarResultadoBuscaAluno('erro', e.message);
  } finally {
    btnBuscarAluno.disabled = false;
  }
});

function mostrarResultadoBuscaAluno(tipo, html, ehHtml) {
  buscaAlunoResultado.hidden = false;
  buscaAlunoResultado.className = `busca-aluno-resultado ${tipo}`;
  if (ehHtml) buscaAlunoResultado.innerHTML = html;
  else buscaAlunoResultado.textContent = html;
}

function normalizarTextoRegra(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

// Valor da regra — QUEM ESCOLHE É O USUÁRIO (feedback de uso real,
// 10/10/2026): antes o sistema travava a regra no valor sozinho sempre que
// o extrato tinha outra transação com a mesma palavra-chave e valor
// diferente (pensado pro caso "mesma pessoa paga lanchonete R$3,50 e livro
// R$120"). Só que compras recorrentes num mesmo fornecedor (ex: um
// supermercado, sempre com valores diferentes) caem exatamente nesse
// padrão — e a regra ficava travada num valor só, sem servir pra nada.
// Agora o padrão é "qualquer valor" (a regra vale pro fornecedor inteiro);
// travar no valor é uma opção explícita. Pra ajudar a decidir, o formulário
// lista as outras transações do extrato que a regra também vai pegar.

// Transações do extrato carregado (fora a própria) que esta regra também
// pegaria — mesma direção e alguma das palavras-chave na descrição.
function transacoesQueARegraPega(contemPalavras, aplicaEm, indiceExcluir) {
  const palavrasNorm = contemPalavras.map(normalizarTextoRegra).filter(Boolean);
  if (palavrasNorm.length === 0 || !planoAtual) return [];
  return planoAtual.filter((item, i) => {
    if (i === indiceExcluir) return false;
    const t = item.transacao;
    if (aplicaEm && t.tipo !== aplicaEm) return false;
    const descNorm = normalizarTextoRegra(t.descricao);
    return palavrasNorm.some((p) => descNorm.includes(p));
  });
}

function aplicaEmDaRegraEmEdicao(item) {
  return indiceArquivoRegraEmEdicao !== null ? (item.regraAplicaEm || null) : item.transacao.tipo;
}

// Valor em que a regra trava se o usuário escolher "só este valor" —
// editando, mantém o valor já gravado na regra.
function valorParaTravar(item) {
  if (indiceArquivoRegraEmEdicao !== null && item.regraValorExato !== null && item.regraValorExato !== undefined) {
    return item.regraValorExato;
  }
  return item.transacao.valor;
}

// Prepara a escolha de valor ao abrir o formulário (criar ou editar).
function prepararEscolhaValor() {
  const item = indiceRegraEmEdicao !== null ? planoAtual[indiceRegraEmEdicao] : null;
  const travada = Boolean(item) && indiceArquivoRegraEmEdicao !== null
    && item.regraValorExato !== null && item.regraValorExato !== undefined;
  regraValorExato.checked = travada;
  regraValorQualquer.checked = !travada;
  atualizarInfoValorExato();
}

function atualizarInfoValorExato() {
  if (indiceRegraEmEdicao === null) { regraInfoValorExato.hidden = true; blocoValorRegra.hidden = true; return; }
  const item = planoAtual[indiceRegraEmEdicao];
  if (!item) { regraInfoValorExato.hidden = true; blocoValorRegra.hidden = true; return; }

  if (modoRegraEspecifica) {
    blocoValorRegra.hidden = true;
    regraInfoValorExato.hidden = false;
    regraInfoValorExato.textContent = `Esta regra vale só para esta transação específica (mesma descrição completa e valor exato de R$ ${formatarMoeda(item.transacao.valor)}).`;
    return;
  }

  if (regraTela.value === 'recebimento_composto') {
    blocoValorRegra.hidden = true;
    regraInfoValorExato.hidden = false;
    regraInfoValorExato.textContent = `Recibo com vários itens vale só para o valor exato deste Pix (R$ ${formatarMoeda(item.transacao.valor)}).`;
    return;
  }
  regraInfoValorExato.hidden = true;
  blocoValorRegra.hidden = false;
  textoValorExatoRegra.textContent = `R$ ${formatarMoeda(valorParaTravar(item))}`;

  const contem = regraContem.value.split(',').map((p) => p.trim()).filter(Boolean);
  const outras = transacoesQueARegraPega(contem, aplicaEmDaRegraEmEdicao(item), indiceRegraEmEdicao);
  if (outras.length === 0) {
    regraOutrasTransacoes.hidden = true;
    return;
  }
  const MAX = 5;
  const lista = outras.slice(0, MAX)
    .map((o) => `${escaparHtml(o.transacao.data)} R$ ${formatarMoeda(o.transacao.valor)}`)
    .join('; ');
  const resto = outras.length > MAX ? ` e mais ${outras.length - MAX}` : '';
  regraOutrasTransacoes.hidden = false;
  regraOutrasTransacoes.innerHTML = `Com "qualquer valor", esta regra também pega ${outras.length} outra(s) transação(ões) deste extrato: ${lista}${resto}.`;
}

function atualizarCamposPorTela() {
  const tela = regraTela.value;
  regraCamposContribuicao.hidden = tela !== 'recebimento_contribuicao';
  regraCamposPagamento.hidden = tela !== 'pagamento_outros';
  regraCamposDoacao.hidden = tela !== 'recebimento_doacao';
  regraCamposAvulso.hidden = tela !== 'recebimento_avulso' && tela !== 'recebimento_inscricao';
  // Mesmo campo de texto serve pras 2 telas — só troca a lista de
  // sugestões (datalist) conforme qual das duas está selecionada.
  regraRubricaAvulsoNome.setAttribute('list', tela === 'recebimento_inscricao' ? 'listaRubricasInscricao' : 'listaRubricasAvulso');
  regraLinhaEmitirRecibo.hidden = tela === 'pagamento_outros' || tela === 'transferencia';
  regraCamposTransferencia.hidden = tela !== 'transferencia';
  regraLinhaInteressadoComplemento.hidden = tela === 'transferencia';
  if (tela === 'transferencia') prepararCamposTransferencia();
  avaliarPixContribuicao();
  regraCamposComposto.hidden = tela !== 'recebimento_composto';
  if (tela === 'recebimento_composto' && listaItensRecibo.children.length === 0) prepararItensReciboIniciais();
  atualizarInfoValorExato();
}

// --- Recebimento com vários itens num recibo só ----------------------------
// Cada linha: tipo (contribuição/avulso/inscrição/doação), os campos do
// tipo e o valor. A soma precisa bater com o valor do Pix — o rodapé mostra
// em verde/vermelho, e salvar recusa se não bater (o servidor confere de
// novo, e o lançamento confere o Total do recibo no Mercúrio).
const TIPOS_ITEM = [
  ['contribuicao', 'Contribuição'],
  ['avulso', 'Avulso'],
  ['inscricao', 'Inscrição'],
  ['doacao', 'Doação'],
];

function lerValorDigitado(texto) {
  const limpo = String(texto || '').trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const v = Number(limpo);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
}

function normalizarMes(texto) {
  const m = String(texto || '').trim().match(/^(\d{1,2})\/(\d{4})$/);
  return m ? `${m[1].padStart(2, '0')}/${m[2]}` : String(texto || '').trim();
}

function camposDoItemHtml(item) {
  if (item.tipo === 'contribuicao') {
    return `<div class="campos-item">
      <label>Matrícula<input type="text" class="item-matricula" inputmode="numeric" value="${escaparHtml(item.matricula || '')}"></label>
      <label>Mês (MM/AAAA)<input type="text" class="item-mes" placeholder="em branco = mais antigo" title="Em branco: usa o mês pendente mais antigo (com 2 contribuições, os 2 mais antigos, em ordem)" value="${escaparHtml(item.mesReferencia || '')}"></label>
    </div>`;
  }
  if (item.tipo === 'doacao') {
    const opcoes = ((rubricasCache && rubricasCache.doacao) || [])
      .map((d) => `<option value="${escaparHtml(d.id)}" ${String(d.id) === String(item.rubricaId) ? 'selected' : ''}>${escaparHtml(d.nome)}</option>`).join('');
    return `<div class="campos-item um-campo"><label>Tipo de doação<select class="item-doacao">${opcoes}</select></label></div>`;
  }
  const lista = item.tipo === 'inscricao' ? 'listaRubricasInscricao' : 'listaRubricasAvulso';
  return `<div class="campos-item um-campo"><label>Rubrica (nome exato)<input type="text" class="item-rubrica" list="${lista}" placeholder="ex: LANCHONETE" value="${escaparHtml(item.rubricaNome || '')}"></label></div>`;
}

function adicionarLinhaItemRecibo(item = { tipo: 'avulso' }) {
  const linha = document.createElement('div');
  linha.className = 'item-recibo';
  linha.innerHTML = `
    <label>Tipo<select class="item-tipo">${TIPOS_ITEM.map(([v, r]) => `<option value="${v}" ${v === item.tipo ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <div class="item-campos">${camposDoItemHtml(item)}</div>
    <label>Valor (R$)<input type="text" class="item-valor" inputmode="decimal" placeholder="0,00" value="${item.valor ? formatarMoeda(item.valor) : ''}"></label>
    <button type="button" class="remover-item" title="Remover item" aria-label="Remover item">✕</button>`;
  listaItensRecibo.appendChild(linha);
  atualizarSomaItensRecibo();
}

function prepararItensReciboIniciais(itens) {
  listaItensRecibo.innerHTML = '';
  if (itens && itens.length) {
    itens.forEach((i) => adicionarLinhaItemRecibo(i));
    return;
  }
  // Começa com a contribuição da matrícula já informada/buscada + um item avulso.
  adicionarLinhaItemRecibo({ tipo: 'contribuicao', matricula: regraMatricula.value.trim(), mesReferencia: normalizarMes(regraMesReferencia.value) });
  adicionarLinhaItemRecibo({ tipo: 'avulso' });
}

function lerItensRecibo() {
  return [...listaItensRecibo.querySelectorAll('.item-recibo')].map((linha) => {
    // Tolerante a campos ausentes: ao trocar o tipo, o evento "input" chega
    // antes de os campos do novo tipo serem desenhados.
    const valorDe = (seletor) => (linha.querySelector(seletor)?.value || '').trim();
    const tipo = valorDe('.item-tipo');
    const item = { tipo, valor: lerValorDigitado(valorDe('.item-valor')) };
    if (tipo === 'contribuicao') {
      item.matricula = valorDe('.item-matricula');
      item.mesReferencia = normalizarMes(valorDe('.item-mes'));
    } else if (tipo === 'doacao') {
      const sel = linha.querySelector('.item-doacao');
      item.rubricaId = sel ? sel.value : '';
      item.rubricaNome = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].textContent : '';
    } else {
      item.rubricaNome = valorDe('.item-rubrica');
    }
    return item;
  });
}

function valorDaTransacaoEmEdicao() {
  const item = indiceRegraEmEdicao !== null ? planoAtual[indiceRegraEmEdicao] : null;
  return item ? item.transacao.valor : 0;
}

function atualizarSomaItensRecibo() {
  const itens = lerItensRecibo();
  const soma = Math.round(itens.reduce((s, i) => s + (Number.isFinite(i.valor) ? i.valor : 0), 0) * 100) / 100;
  const alvo = valorDaTransacaoEmEdicao();
  const bate = Math.abs(soma - alvo) < 0.005;
  const falta = Math.round((alvo - soma) * 100) / 100;
  somaItensRecibo.className = `soma-itens-recibo ${bate ? 'ok' : 'erro'}`;
  somaItensRecibo.textContent = bate
    ? `Soma: R$ ${formatarMoeda(soma)} — bate com o Pix ✓`
    : `Soma: R$ ${formatarMoeda(soma)} de R$ ${formatarMoeda(alvo)} (${falta > 0 ? 'faltam' : 'sobram'} R$ ${formatarMoeda(Math.abs(falta))})`;
}

btnAdicionarItemRecibo.addEventListener('click', () => adicionarLinhaItemRecibo({ tipo: 'avulso' }));

// Atalho nos campos de Contribuição: troca para "vários itens num recibo
// só" levando a contribuição já preenchida (matrícula e mês) + um item
// novo com o valor que falta para fechar o Pix.
// --- Composição das contribuições (ativos + valor de cada um) -------------
// Lida no Mercúrio em segundo plano, junto com as rubricas, logo depois de
// escolher o caixa (ver atualizarRubricasEmSegundoPlano()). Usada para:
//   - avisar já no formulário quando o Pix é maior que a contribuição da
//     pessoa (pedido do usuário, 10-11/10/2026) → "Montar recibo com vários
//     itens", com a contribuição e o valor que sobra preenchidos;
//   - a busca por nome (o servidor procura nesta lista antes do Mercúrio).
let composicaoAtual = { filial: null, alunos: [] };

async function carregarComposicao() {
  const filial = selectFilial.value;
  if (!filial) return;
  try {
    const resp = await fetch(`/economia/tesouraria/api/composicao?filial=${encodeURIComponent(filial)}`);
    if (!resp.ok) return;
    const dados = await resp.json();
    composicaoAtual = { filial, alunos: dados.alunos || [] };
    avaliarPixContribuicao();
  } catch { /* sem a lista, o formulário funciona como antes */ }
}

function contribuicaoDaMatricula(matricula) {
  if (!matricula || composicaoAtual.filial !== selectFilial.value) return null;
  return composicaoAtual.alunos.find((a) => a.matricula === String(matricula).trim()) || null;
}

let sugestaoAvisoPix = null;

function avaliarPixContribuicao() {
  const aviso = document.getElementById('avisoPixMaior');
  aviso.hidden = true;
  sugestaoAvisoPix = null;
  const item = indiceRegraEmEdicao !== null ? planoAtual && planoAtual[indiceRegraEmEdicao] : null;
  if (!item || item.transacao.tipo !== 'credito' || regraTela.value !== 'recebimento_contribuicao') return;
  const pessoa = contribuicaoDaMatricula(regraMatricula.value);
  if (!pessoa || !(pessoa.valor > 0)) return;
  const pix = item.transacao.valor;
  const sobra = Math.round((pix - pessoa.valor) * 100) / 100;
  if (sobra < 0.005) return; // igual ou menor: regras de sempre (pontualidade etc.)
  sugestaoAvisoPix = { matricula: pessoa.matricula, valorContribuicao: pessoa.valor, sobra };
  document.getElementById('textoAvisoPixMaior').textContent = sobra > 10
    ? `O Pix (R$ ${formatarMoeda(pix)}) é maior que a contribuição de ${pessoa.nome} (R$ ${formatarMoeda(pessoa.valor)}) — sobram R$ ${formatarMoeda(sobra)}. Provavelmente paga mais de um item no mesmo recibo.`
    : `O Pix (R$ ${formatarMoeda(pix)}) é R$ ${formatarMoeda(sobra)} maior que a contribuição de ${pessoa.nome} (R$ ${formatarMoeda(pessoa.valor)}). Se for outro item, monte o recibo com vários itens; se for só arredondamento, pode salvar assim.`;
  aviso.hidden = false;
}

regraMatricula.addEventListener('input', avaliarPixContribuicao);

// Com a sugestão do aviso, o recibo já vem com a contribuição no valor da
// pessoa e o item que sobra; sem ela, o atalho comum.
document.getElementById('btnAvisoMaisItens').addEventListener('click', () => {
  const sugestao = sugestaoAvisoPix;
  document.getElementById('btnMaisItensRecibo').click();
  if (!sugestao) return;
  prepararItensReciboIniciais([
    { tipo: 'contribuicao', matricula: sugestao.matricula, mesReferencia: normalizarMes(regraMesReferencia.value), valor: sugestao.valorContribuicao },
    { tipo: 'avulso', valor: sugestao.sobra },
  ]);
  atualizarSomaItensRecibo();
  const rubrica = listaItensRecibo.querySelector('.item-recibo:last-child .item-rubrica');
  if (rubrica) rubrica.focus();
});

document.getElementById('btnMaisItensRecibo').addEventListener('click', () => {
  regraTela.value = 'recebimento_composto';
  const total = valorDaTransacaoEmEdicao();
  listaItensRecibo.innerHTML = '';
  adicionarLinhaItemRecibo({ tipo: 'contribuicao', matricula: regraMatricula.value.trim(), mesReferencia: normalizarMes(regraMesReferencia.value) });
  adicionarLinhaItemRecibo({ tipo: 'avulso' });
  atualizarCamposPorTela();
  if (total) listaItensRecibo.querySelector('.item-recibo .item-valor').focus();
});
listaItensRecibo.addEventListener('click', (e) => {
  const remover = e.target.closest('.remover-item');
  if (!remover) return;
  remover.closest('.item-recibo').remove();
  atualizarSomaItensRecibo();
});
listaItensRecibo.addEventListener('change', (e) => {
  const tipo = e.target.closest('.item-tipo');
  if (tipo) {
    const linha = tipo.closest('.item-recibo');
    linha.querySelector('.item-campos').innerHTML = camposDoItemHtml({ tipo: tipo.value, matricula: regraMatricula.value.trim() });
  }
  atualizarSomaItensRecibo();
});
listaItensRecibo.addEventListener('input', atualizarSomaItensRecibo);
regraTela.addEventListener('change', atualizarCamposPorTela);

// Transferência entre caixas: o "outro caixa" é o destino numa saída do
// extrato e a origem numa entrada (ver ondeLancar() em lib/executor.js).
// Lista os caixas da filial (os mesmos do seletor de caixa padrão), menos
// o caixa desta transação.
function prepararCamposTransferencia(valorAtual) {
  const item = indiceRegraEmEdicao !== null ? planoAtual[indiceRegraEmEdicao] : null;
  const entrada = item && item.transacao.tipo === 'credito';
  const caixaDaLinha = (item && caixasPorIndiceOverride[indiceRegraEmEdicao]) || selectCaixaPadrao.value;
  const selecionado = valorAtual !== undefined ? valorAtual : regraCaixaOutro.value;
  const opcoes = caixasDisponiveis.filter((c) => c !== caixaDaLinha);
  regraCaixaOutro.innerHTML = '<option value="">— escolha —</option>'
    + opcoes.map((c) => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join('');
  if (selecionado && !opcoes.includes(selecionado)) {
    regraCaixaOutro.insertAdjacentHTML('beforeend', `<option value="${escaparHtml(selecionado)}">${escaparHtml(selecionado)}</option>`);
  }
  regraCaixaOutro.value = selecionado || '';
  rotuloCaixaOutro.textContent = entrada ? 'Caixa de origem (de onde o dinheiro veio)' : 'Caixa destino (para onde o dinheiro vai)';
  explicacaoTransferencia.textContent = entrada
    ? `Entrada no extrato: a transferência é lançada no dia do caixa de origem, saindo dele para "${caixaDaLinha || 'o caixa do extrato'}".`
    : `Saída no extrato: a transferência é lançada no dia de "${caixaDaLinha || 'o caixa do extrato'}", indo para o caixa destino.`;
}

regraContem.addEventListener('input', atualizarInfoValorExato);

async function abrirModalCriarRegra(indice, opcoes) {
  const item = planoAtual[indice];
  if (!item) return;
  const especifico = !!(opcoes && opcoes.especifico);
  modoRegraEspecifica = especifico;
  indiceRegraEmEdicao = indice;
  indiceArquivoRegraEmEdicao = null;
  modalCriarRegraTitulo.textContent = especifico ? 'Somente este lançamento' : 'Criar regra a partir desta transação';
  btnSalvarRegraTexto.textContent = especifico ? 'Salvar (só este lançamento)' : 'Salvar regra';
  btnExcluirRegra.hidden = true;
  regraErro.hidden = true;

  const t = item.transacao;
  const sinal = t.tipo === 'credito' ? '+' : '−';
  modalTransacaoPreview.innerHTML = `
    <div class="modal-transacao-linha">${escaparHtml(t.data)} — <strong class="${t.tipo === 'credito' ? 'valor-credito' : 'valor-debito'}">${sinal} R$ ${formatarMoeda(t.valor)}</strong></div>
    <div class="modal-transacao-desc">${escaparHtml(t.descricao)}</div>
  `;

  // No modo "somente este lançamento", usa a descrição INTEIRA (não a
  // sugestão resumida) como palavra-chave — junto com o valor exato
  // (sempre travado nesse modo, ver atualizarInfoValorExato()/salvar
  // abaixo), isso é específico o bastante pra nunca bater em outra
  // transação por engano.
  const sugestao = sugerirPalavraChave(t.descricao);
  const textoInicial = especifico ? t.descricao : sugestao;
  regraNome.value = textoInicial;
  regraContem.value = textoInicial;
  regraTela.value = t.tipo === 'credito' ? 'recebimento_contribuicao' : 'pagamento_outros';
  regraMatricula.value = '';
  regraMesReferencia.value = '';
  regraRubricaPagamentoBusca.value = '';
  regraRubricaAvulsoNome.value = '';
  // Pra Contribuições, o Mercúrio já preenche "Interessado" SOZINHO com o
  // nome real cadastrado na matrícula — nunca prefiche aqui com a
  // sugestão tirada do extrato (pode ser o nome de uma EMPRESA que fez o
  // Pix, ex: "ADAVIT", quando quem está matriculado é a pessoa dona dela,
  // ex: "Adanaielly" — bug real relatado pelo usuário). Fica em branco até
  // uma busca confirmar o nome de verdade (ver jaEncontrado abaixo e o
  // handler de btnBuscarAluno). Nas outras telas não existe esse
  // auto-preenchimento do Mercúrio, então a sugestão do extrato continua
  // sendo o melhor palpite disponível.
  regraInteressado.value = t.tipo === 'credito' ? '' : sugestao;
  regraComplemento.value = '';
  regraEmitirRecibo.checked = false;
  listaItensRecibo.innerHTML = '';
  regraBuscaNomeAluno.value = t.tipo === 'credito' ? sugestao : '';
  buscaAlunoResultado.hidden = true;
  statusAtualizarRubricas.hidden = true;
  atualizarCamposPorTela();
  prepararEscolhaValor();

  // Se a busca em lote já achou a matrícula dessa transação antes, já
  // vem preenchido, sem precisar clicar "Buscar" de novo.
  const jaEncontrado = matriculasEncontradasPorIndice[indice];
  if (jaEncontrado) {
    regraMatricula.value = jaEncontrado.matricula;
    regraInteressado.value = jaEncontrado.nomeConfirmado;
    mostrarResultadoBuscaAluno('sucesso', `✓ ${jaEncontrado.nomeConfirmado} — matrícula ${jaEncontrado.matricula} (achado na busca em lote)`);
  }

  // Abre o modal JÁ AQUI, antes de buscar as rubricas — se a busca falhar
  // (servidor desatualizado, rede etc.) o formulário continua utilizável
  // (a pessoa só não vai ter a lista de rubricas pronta), em vez de o
  // clique inteiro não fazer nada visível.
  modalCriarRegra.hidden = false;
  regraNome.focus();

  try {
    await carregarRubricasSeNecessario();
    if (rubricasCache.doacao.length) regraRubricaDoacao.value = rubricasCache.doacao[0].id;
  } catch (e) {
    mostrarErroRegra(`Não consegui carregar a lista de rubricas: ${e.message}`);
  }
}

// Abre o MESMO modal/formulário de "Criar regra", mas já preenchido com o
// conteúdo da regra que casou com esta transação — pedido do usuário
// (ícone "Editar" logo abaixo do "regra: ..." de um lançamento já
// reconhecido, pra não precisar editar regras.json na mão). Salvar grava
// no lugar exato da regra em regras.json (item.regraIndice), não cria uma
// regra nova.
async function abrirModalEditarRegra(indice) {
  const item = planoAtual[indice];
  if (!item || !item.temRegra || item.regraIndice === null || item.regraIndice === undefined) return;
  modoRegraEspecifica = false;
  indiceRegraEmEdicao = indice;
  indiceArquivoRegraEmEdicao = item.regraIndice;
  modalCriarRegraTitulo.textContent = 'Editar regra';
  btnSalvarRegraTexto.textContent = 'Salvar alterações';
  btnExcluirRegra.hidden = false;
  regraErro.hidden = true;

  const t = item.transacao;
  const sinal = t.tipo === 'credito' ? '+' : '−';
  modalTransacaoPreview.innerHTML = `
    <div class="modal-transacao-linha">${escaparHtml(t.data)} — <strong class="${t.tipo === 'credito' ? 'valor-credito' : 'valor-debito'}">${sinal} R$ ${formatarMoeda(t.valor)}</strong></div>
    <div class="modal-transacao-desc">${escaparHtml(t.descricao)}</div>
  `;

  const acao = item.regraAcao || {};
  regraNome.value = item.nomeRegra || '';
  regraContem.value = (item.regraContem || []).join(', ');
  regraTela.value = acao.tela || (t.tipo === 'credito' ? 'recebimento_contribuicao' : 'pagamento_outros');
  regraMatricula.value = acao.matricula || '';
  regraMesReferencia.value = acao.mesReferencia || '';
  regraRubricaPagamentoBusca.value = acao.tela === 'pagamento_outros' ? (acao.rubricaNome || '') : '';
  regraRubricaAvulsoNome.value = (acao.tela === 'recebimento_avulso' || acao.tela === 'recebimento_inscricao') ? (acao.rubricaNome || '') : '';
  regraInteressado.value = acao.interessado || '';
  regraComplemento.value = acao.complemento || '';
  regraEmitirRecibo.checked = !!acao.emitirRecibo;
  regraBuscaNomeAluno.value = '';
  buscaAlunoResultado.hidden = true;
  statusAtualizarRubricas.hidden = true;
  if (acao.tela === 'transferencia') prepararCamposTransferencia(acao.caixaOutro || '');
  listaItensRecibo.innerHTML = '';
  if (acao.tela === 'recebimento_composto') prepararItensReciboIniciais(acao.itens || []);
  atualizarCamposPorTela();
  prepararEscolhaValor();

  modalCriarRegra.hidden = false;
  regraNome.focus();

  try {
    await carregarRubricasSeNecessario();
    if (acao.tela === 'recebimento_doacao' && acao.rubricaId) regraRubricaDoacao.value = acao.rubricaId;
  } catch (e) {
    mostrarErroRegra(`Não consegui carregar a lista de rubricas: ${e.message}`);
  }
}

function fecharModalCriarRegra() {
  modalCriarRegra.hidden = true;
  indiceRegraEmEdicao = null;
  indiceArquivoRegraEmEdicao = null;
  modoRegraEspecifica = false;
}
btnCancelarRegra.addEventListener('click', fecharModalCriarRegra);
btnFecharModalRegra.addEventListener('click', fecharModalCriarRegra);
modalCriarRegra.addEventListener('click', (e) => {
  if (e.target === modalCriarRegra) fecharModalCriarRegra();
});

function acharIdRubricaPagamentoPeloNomeDigitado(nomeDigitado) {
  const alvo = nomeDigitado.trim().toLowerCase();
  const achado = rubricasCache.pagamento.find((r) => r.nome.toLowerCase() === alvo);
  return achado ? achado.id : null;
}

btnSalvarRegra.addEventListener('click', async () => {
  regraErro.hidden = true;
  if (indiceRegraEmEdicao === null) return;
  const item = planoAtual[indiceRegraEmEdicao];

  const nome = regraNome.value.trim();
  const contem = regraContem.value.split(',').map((p) => p.trim()).filter(Boolean);
  const tela = regraTela.value;

  if (!nome) return mostrarErroRegra('Dê um nome pra essa regra.');
  if (contem.length === 0) return mostrarErroRegra('Informe ao menos uma palavra-chave em "Contém".');

  const acao = { tela };
  if (tela === 'recebimento_contribuicao') {
    const matricula = regraMatricula.value.trim();
    if (!matricula) return mostrarErroRegra('Matrícula é obrigatória para Recebimento > Contribuições.');
    acao.matricula = matricula;
    if (regraMesReferencia.value.trim()) acao.mesReferencia = regraMesReferencia.value.trim();
    acao.emitirRecibo = regraEmitirRecibo.checked;
  } else if (tela === 'pagamento_outros') {
    const id = acharIdRubricaPagamentoPeloNomeDigitado(regraRubricaPagamentoBusca.value);
    if (!id) return mostrarErroRegra('Escolha uma rubrica válida da lista (clique no campo pra ver as opções).');
    acao.rubricaId = id;
    acao.rubricaNome = regraRubricaPagamentoBusca.value.trim();
  } else if (tela === 'recebimento_composto') {
    if (item.transacao.tipo !== 'credito') return mostrarErroRegra('Recibo com vários itens só vale para entradas (Pix recebido).');
    const itens = lerItensRecibo();
    if (itens.length < 2) return mostrarErroRegra('Adicione pelo menos 2 itens (para um item só, use a ação normal).');
    const invalido = itens.findIndex((i) => !(i.valor > 0));
    if (invalido >= 0) return mostrarErroRegra(`Item ${invalido + 1}: informe o valor.`);
    const soma = Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100;
    if (Math.abs(soma - item.transacao.valor) >= 0.005) {
      return mostrarErroRegra(`A soma dos itens (R$ ${formatarMoeda(soma)}) precisa ser igual ao valor do Pix (R$ ${formatarMoeda(item.transacao.valor)}).`);
    }
    acao.itens = itens;
    acao.emitirRecibo = regraEmitirRecibo.checked;
  } else if (tela === 'transferencia') {
    if (!regraCaixaOutro.value) return mostrarErroRegra(regraCaixaOutro.options.length <= 1 ? 'Nenhum outro caixa disponível — liste os caixas da filial na etapa 1.' : 'Escolha o outro caixa da transferência.');
    acao.caixaOutro = regraCaixaOutro.value;
  } else if (tela === 'recebimento_avulso' || tela === 'recebimento_inscricao') {
    const rubricaNome = regraRubricaAvulsoNome.value.trim();
    if (!rubricaNome) return mostrarErroRegra('Informe o nome exato da rubrica (confira no Mercúrio, aba Avulsos/Inscrições do Recibo).');
    acao.rubricaNome = rubricaNome;
    acao.emitirRecibo = regraEmitirRecibo.checked;
  } else {
    if (!regraRubricaDoacao.value) return mostrarErroRegra('Escolha o tipo de doação.');
    acao.rubricaId = regraRubricaDoacao.value;
    acao.rubricaNome = regraRubricaDoacao.options[regraRubricaDoacao.selectedIndex].textContent;
    acao.emitirRecibo = regraEmitirRecibo.checked;
  }
  if (tela !== 'transferencia') {
    if (regraInteressado.value.trim()) acao.interessado = regraInteressado.value.trim();
    if (regraComplemento.value.trim()) acao.complemento = regraComplemento.value.trim();
  }

  // Valor: escolha do usuário (ver prepararEscolhaValor()). "Somente este
  // lançamento" sempre trava no valor exato desta transação.
  let valorExato;
  if (modoRegraEspecifica || tela === 'recebimento_composto') {
    // Recibo com vários itens vale sempre só para o valor exato do Pix.
    valorExato = item.transacao.valor;
  } else {
    valorExato = regraValorExato.checked ? valorParaTravar(item) : null;
  }

  // Ao EDITAR, preserva o "aplicaEm" original da regra em vez de derivar de
  // novo do tipo desta transação — uma regra sem "aplicaEm" vale pra
  // crédito E débito; recalcular a partir da transação que a abriu iria
  // silenciosamente ESTREITAR uma regra que hoje se aplica aos dois casos.
  const aplicaEm = indiceArquivoRegraEmEdicao !== null ? (item.regraAplicaEm || null) : item.transacao.tipo;
  const novaRegra = { nome, contem, aplicaEm, valorExato, acao };

  btnSalvarRegra.disabled = true;
  try {
    const editando = indiceArquivoRegraEmEdicao !== null;
    const resp = await fetch(editando ? '/economia/tesouraria/api/regras/editar' : '/economia/tesouraria/api/regras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editando ? { indice: indiceArquivoRegraEmEdicao, regra: novaRegra } : { regra: novaRegra }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao salvar a regra.');

    fecharModalCriarRegra();
    await regerarPlanoAposMudarRegras();
  } catch (e) {
    mostrarErroRegra(e.message);
  } finally {
    btnSalvarRegra.disabled = false;
  }
});

// Excluir regra — só aparece no modo "Editar regra". Pedido do usuário:
// apagar a regra permite voltar a lançar aquela transação manualmente (ou
// deixar uma nova regra pegar no lugar dela), sem precisar editar
// regras.json na mão.
btnExcluirRegra.addEventListener('click', async () => {
  if (indiceArquivoRegraEmEdicao === null) return;
  const nomeRegra = regraNome.value.trim() || 'esta regra';
  if (!confirm(`Excluir a regra "${nomeRegra}"? A transação volta a aparecer como SEM REGRA, pra lançar manualmente (ou criar outra regra).`)) return;

  btnExcluirRegra.disabled = true;
  try {
    const resp = await fetch('/economia/tesouraria/api/regras/excluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indice: indiceArquivoRegraEmEdicao }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao excluir a regra.');

    fecharModalCriarRegra();
    await regerarPlanoAposMudarRegras();
  } catch (e) {
    mostrarErroRegra(e.message);
  } finally {
    btnExcluirRegra.disabled = false;
  }
});

function mostrarErroRegra(msg) {
  regraErro.hidden = false;
  regraErro.textContent = msg;
}

// Re-executa o mesmo passo do botão "Gerar plano", mas silenciosamente
// (sem mexer no botão/estado da etapa 1) — usado depois de salvar uma
// regra nova, pra ela já valer pro extrato inteiro na mesma hora.
async function regerarPlanoAposMudarRegras() {
  if (!arquivoAtual) return;
  statusUpload.textContent = 'Regra salva — aplicando no plano...';
  try {
    const resp = await fetch('/economia/tesouraria/api/plano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arquivoAtual),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao atualizar o plano.');
    planoAtual = dados.plano;
    renderizarPlano(dados.plano, dados.resumo, { reaproveitarVerificacao: true });
    statusUpload.textContent = 'Regra salva e aplicada ao plano.';
  } catch (e) {
    statusUpload.textContent = e.message;
  }
}

// --- Etapa 3: verificar duplicidade no Mercúrio (só leitura) ---------------
// Deixou de ser opcional (pedido do usuário) — dispara SOZINHA assim que o
// plano é gerado/regenerado (ver chamada em renderizarPlano()), e de novo
// se o usuário clicar em "Verificar de novo". Um overlay cobrindo a tela
// inteira (mostrarOverlayProcessando()) fica visível enquanto ela roda,
// pra deixar claro que tem algo em andamento e impedir cliques na tabela
// (criar regra, trocar caixa, lançar) competindo com a checagem ainda em
// curso — antes disso só existia um texto discreto de status, fácil de não
// perceber.

async function executarVerificacaoDuplicidade() {
  if (!arquivoAtual) return;
  const credenciais = obterCredenciais(statusVerificar);
  if (!credenciais) return;
  const filial = obterFilial(statusVerificar);
  if (!filial) return;

  verificacaoPorIndice = {};
  verificacaoCompleta = false;
  btnVerificar.disabled = true;
  btnVerificar.hidden = true;
  statusVerificar.textContent = 'conferindo no Mercúrio (só leitura)...';
  logVerificacao.hidden = false;
  logVerificacao.innerHTML = '';
  mostrarOverlayProcessando('Processando... aguarde.');

  try {
    const resp = await fetch('/economia/tesouraria/api/verificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...arquivoAtual, credenciais, filial, caixaPadrao: selectCaixaPadrao.value, caixasPorIndice: caixasPorIndiceOverride }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao iniciar a verificação.');
    acompanharVerificacao(dados.jobId);
  } catch (e) {
    statusVerificar.textContent = mensagemErroFetch(e);
    btnVerificar.disabled = false;
    btnVerificar.hidden = false;
    esconderOverlayProcessando();
  }
}

btnVerificar.addEventListener('click', () => executarVerificacaoDuplicidade());

function acompanharVerificacao(jobId) {
  if (origemEventos) origemEventos.close();
  origemEventos = abrirStreamJob(jobId);

  origemEventos.onmessage = (msg) => {
    const evento = JSON.parse(msg.data);
    switch (evento.tipo) {
      case 'status':
      case 'aviso':
        statusVerificar.textContent = evento.mensagem;
        adicionarLinhaLogEm(logVerificacao, 'status', evento.mensagem);
        break;
      case 'verificacao_item':
        verificacaoPorIndice[evento.indice] = { parecidos: evento.parecidos, erro: evento.erro };
        marcarDuplicidadeNaTabela(evento.indice, evento.parecidos, evento.erro);
        break;
      case 'verificacao_concluida':
        verificacaoCompleta = true;
        sessaoVerificacaoConcluida();
        statusVerificar.textContent = `Concluído: ${evento.totalVerificado} conferida(s), ${evento.possiveisDuplicatas} com possível duplicata.`;
        break;
      case 'erro_fatal':
        statusVerificar.textContent = `Erro: ${evento.mensagem}`;
        adicionarLinhaLogEm(logVerificacao, 'erro', evento.mensagem);
        break;
      case 'fim_stream':
        origemEventos.close();
        btnVerificar.disabled = false;
        btnVerificar.hidden = false;
        esconderOverlayProcessando();
        break;
    }
  };

  origemEventos.onerror = () => {
    statusVerificar.textContent = 'Conexão com o servidor perdida.';
    origemEventos.close();
    btnVerificar.disabled = false;
    btnVerificar.hidden = false;
    esconderOverlayProcessando();
  };
}

function marcarDuplicidadeNaTabela(indice, parecidos, erro) {
  const linha = corpoTabelaPlano.querySelector(`tr[data-indice="${indice}"]`);
  if (!linha) return;
  const celula = linha.querySelector('.celula-duplicidade');
  if (!celula) return;
  // Texto curto na tela (cabe na coluna sem forçar rolagem lateral — bug
  // real corrigido, 15/09/2026), explicação completa no title (tooltip).
  if (erro) {
    celula.innerHTML = '<span class="badge badge-nao-verificado" title="Não consegui conferir esse dia no Mercúrio (erro de conexão/navegação).">erro ao conferir</span>';
  } else if (parecidos.length === 1) {
    celula.innerHTML = '<span class="badge badge-duplicata" title="Já existe um lançamento com o mesmo valor/direção nesse dia no Mercúrio — provável duplicata.">duplicata</span>';
  } else if (parecidos.length > 1) {
    celula.innerHTML = `<span class="badge badge-ambiguo" title="${parecidos.length} lançamentos parecidos (mesmo valor/direção) já existem nesse dia — ambíguo, não dá pra saber sozinho qual (se algum) já é este.">ambíguo (${parecidos.length}x)</span>`;
  } else {
    celula.innerHTML = '<span class="badge badge-novo" title="Não encontrei nada parecido nesse dia no Mercúrio — parece ser um lançamento novo.">novo</span>';
  }
}

function adicionarLinhaLogEm(container, tipo, texto) {
  const div = document.createElement('div');
  div.className = `log-linha log-${tipo}`;
  div.textContent = texto;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// --- Etapa 4: lançar de verdade, acompanhando por SSE -----------------------

btnLancar.addEventListener('click', async () => {
  if (!arquivoAtual || !planoAtual) return;
  const credenciais = obterCredenciais(null);
  if (!credenciais) {
    alert('Preencha matrícula e senha do Mercúrio (etapa 1) antes de lançar.');
    return;
  }
  const filial = obterFilial(null);
  if (!filial) {
    alert('Escolha a filial (etapa 1) antes de lançar.');
    return;
  }

  const totalComRegra = planoAtual.filter((i) => i.temRegra).length;
  const confirmouAviso = confirm(
    `Isso vai LANÇAR DE VERDADE ${totalComRegra} transação(ões) na Tesouraria, de uma vez — sem parar em nenhum momento (qualquer problema numa transação individual aborta só ela e segue pro resto; o relatório final lista o que não foi lançado e por quê, pra você corrigir e rodar de novo só essas).\n\n` +
    'Tem certeza que revisou o plano acima (e, de preferência, já rodou a verificação de duplicidade) e quer confirmar o lote inteiro?\n\n' +
    'Estou ciente de que essa ferramenta não substitui a vigilância do voluntário ao conferir cada lançamento. Usarei-a com responsabilidade.'
  );
  if (!confirmouAviso) return;

  await iniciarLancamento(null);
});

// `indicesParaLancar` (opcional, array de índices no plano) — quando
// informado, processa só essas transações (usado por "Rodar novamente só
// os que falharam"); null lança tudo, comportamento normal do botão
// principal. O plano é sempre remontado do zero no servidor a partir de
// regras.json (montarPlanoDoCorpo em web/servidor.js), então qualquer
// regra criada/editada desde a última rodada já vale nesta.
async function iniciarLancamento(indicesParaLancar) {
  const credenciais = obterCredenciais(null);
  if (!credenciais) {
    alert('Preencha matrícula e senha do Mercúrio (etapa 1) antes de lançar.');
    return;
  }
  const filial = obterFilial(null);
  if (!filial) {
    alert('Escolha a filial (etapa 1) antes de lançar.');
    return;
  }

  btnLancar.disabled = true;
  painelAndamento.hidden = false;
  logAndamento.innerHTML = '';
  resumoFinal.hidden = true;
  conciliacaoSaldo.hidden = true;
  listaLancamentosRodada.hidden = true;
  listaLancamentosRodada.innerHTML = '';

  try {
    const resp = await fetch('/economia/tesouraria/api/lancar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...arquivoAtual,
        credenciais,
        filial,
        caixaPadrao: selectCaixaPadrao.value,
        caixasPorIndice: caixasPorIndiceOverride,
        ...(indicesParaLancar ? { indicesParaLancar } : {}),
      }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao iniciar o lançamento.');
    sessaoLancamentoIniciado(dados.jobId);
    acompanharLancamento(dados.jobId);
  } catch (e) {
    adicionarLinhaLog('erro', `Erro ao iniciar: ${mensagemErroFetch(e)}`);
    btnLancar.disabled = false;
  }
}

function acompanharLancamento(jobId) {
  if (origemEventos) origemEventos.close();
  origemEventos = abrirStreamJob(jobId);

  let linhaAtual = null;

  origemEventos.onmessage = (msg) => {
    const evento = JSON.parse(msg.data);
    switch (evento.tipo) {
      case 'status':
      case 'aviso':
        adicionarLinhaLog('status', evento.mensagem);
        break;
      case 'transacao_inicio': {
        const t = evento.transacao;
        const sinal = t.tipo === 'credito' ? '+' : '−';
        linhaAtual = adicionarLinhaLog('processando', `${t.data}  ${sinal} R$ ${formatarMoeda(t.valor)}  ${t.descricao}`, true);
        break;
      }
      case 'transacao_fim': {
        if (evento.resultado === 'lancado') sessaoTransacaoLancada(evento.indice);
        if (linhaAtual) {
          linhaAtual.classList.remove('log-processando');
          linhaAtual.classList.add(`log-${evento.resultado}`);
          if (evento.motivo) {
            const p = document.createElement('div');
            p.className = 'log-motivo';
            p.textContent = evento.resultado === 'erro' ? `Erro: ${evento.motivo}` : evento.motivo;
            linhaAtual.appendChild(p);
          } else if (evento.resultado === 'lancado') {
            const p = document.createElement('div');
            p.className = 'log-motivo';
            p.textContent = 'Lançado com sucesso.';
            linhaAtual.appendChild(p);
          }
        }
        linhaAtual = null;
        break;
      }
      case 'conciliacao_saldo':
        mostrarConciliacaoSaldo(evento.mensagem, evento.diferencas);
        break;
      case 'concluido':
        mostrarResumoFinal(evento.resultado);
        break;
      case 'erro_fatal':
        adicionarLinhaLog('erro', `Erro: ${evento.mensagem}`);
        break;
      case 'fim_stream':
        origemEventos.close();
        btnLancar.disabled = false;
        sessaoLancamentoTerminou();
        break;
    }
    logAndamento.scrollTop = logAndamento.scrollHeight;
  };

  origemEventos.onerror = () => {
    // O lançamento roda no servidor, não nesta página — perder a conexão
    // não para o lote. Lançar de novo sem conferir poderia duplicar.
    adicionarLinhaLog('erro', 'Perdi a conexão com o servidor e parei de acompanhar. O lançamento pode ter continuado rodando lá: confira no Mercúrio o que já entrou antes de lançar de novo (a verificação de duplicidade ajuda nisso).');
    origemEventos.close();
    btnLancar.disabled = false;
  };
}

function adicionarLinhaLog(tipo, texto, comCabecalho) {
  const div = document.createElement('div');
  div.className = `log-linha log-${tipo}`;
  if (comCabecalho) {
    div.innerHTML = `<div class="log-cabecalho"><span>${escaparHtml(texto)}</span></div>`;
  } else {
    div.textContent = texto;
  }
  logAndamento.appendChild(div);
  logAndamento.scrollTop = logAndamento.scrollHeight;
  return div;
}

function nomeTelaLocal(tela) {
  if (tela === 'pagamento_outros') return 'Pagamento Outros';
  if (tela === 'recebimento_contribuicao') return 'Recebimento > Contribuições';
  if (tela === 'recebimento_avulso') return 'Recebimento > Avulsos';
  if (tela === 'recebimento_inscricao') return 'Recebimento > Inscrições';
  if (tela === 'transferencia') return 'Transferência entre caixas';
  if (tela === 'recebimento_composto') return 'Recebimento > Vários itens (um recibo)';
  return 'Recebimento > Doações';
}

// Guarda o resultado da última rodada (inclui itensLancados, com detalhe
// suficiente pra listar o que reverter manualmente) — os botões
// "Estornar"/"Ver lançamentos" (tanto o da conciliação de saldo quanto o
// do resumo final) usam essa mesma referência.
let ultimoResultadoLancamento = null;

function mostrarResumoFinal(resultado) {
  ultimoResultadoLancamento = resultado;
  resumoFinal.hidden = false;
  resumoFinal.innerHTML = `
    <div class="item"><strong>${resultado.lancados}</strong>lançados</div>
    <div class="item"><strong>${resultado.pulados}</strong>pulados</div>
    <div class="item"><strong>${resultado.erros}</strong>erros</div>
  `;
  if (resultado.lancados > 0) {
    const botaoEstornar = document.createElement('button');
    botaoEstornar.type = 'button';
    botaoEstornar.className = 'botao-secundario botao-estornar-rodada';
    botaoEstornar.textContent = 'Estornar todos os lançamentos desta rodada';
    botaoEstornar.addEventListener('click', () => mostrarListaLancamentos(ultimoResultadoLancamento.itensLancados));
    resumoFinal.appendChild(botaoEstornar);
  }
  if (resultado.itensComErro && resultado.itensComErro.length > 0) {
    resumoFinal.appendChild(montarPainelItensComErro(resultado.itensComErro));
  }
}

// Lista, um por um, o que NÃO foi lançado e por quê — pedido do usuário:
// nunca só um número de "erros", sempre o motivo de cada um, com um jeito
// de corrigir (criar/editar a regra daquela transação) e rodar de novo só
// esses, sem repetir quem já foi lançado com sucesso.
// Pix maior que a contribuição: abre "Somente este lançamento" já no modo
// "vários itens", com a contribuição (matrícula, mês e valor real da ficha,
// lidos no Mercúrio na hora do lançamento) e um 2º item com o que sobra —
// falta só escolher a rubrica do restante. A regra criada vale só para esta
// transação (descrição completa + valor exato), então a regra normal de
// contribuição da pessoa continua valendo nos próximos meses.
async function abrirReciboComMaisItens(indice, sugestao) {
  await abrirModalCriarRegra(indice, { especifico: true });
  regraTela.value = 'recebimento_composto';
  prepararItensReciboIniciais([
    { tipo: 'contribuicao', matricula: sugestao.matricula, mesReferencia: sugestao.mesReferencia, valor: sugestao.valorContribuicao },
    { tipo: 'avulso', valor: sugestao.sobra },
  ]);
  atualizarCamposPorTela();
  const rubrica = listaItensRecibo.querySelector('.item-recibo:last-child .item-rubrica');
  if (rubrica) rubrica.focus();
}

// Diferença de até R$10 entre o Pix e a contribuição (fora do desconto de
// pontualidade): pergunta se é para lançar com o valor recebido. Ao
// confirmar, cria uma regra SÓ para esta transação (descrição completa +
// valor exato) que lança a ficha do mês e ajusta o item para o valor do Pix
// — a regra normal da pessoa continua valendo nos próximos meses.
async function ajustarContribuicaoParaValorRecebido(indice, sugestao, botao) {
  const item = planoAtual[indice];
  if (!item) return;
  const t = item.transacao;
  const pergunta = `Lançar a contribuição de ${sugestao.mesReferencia} (matrícula ${sugestao.matricula}, ficha de R$ ${formatarMoeda(sugestao.valorContribuicao)}) com o valor recebido de R$ ${formatarMoeda(sugestao.valorRecebido)}?\n\nIsso vale só para este lançamento.`;
  if (!confirm(pergunta)) return;
  const acaoOriginal = item.regraAcao || {};
  const regra = {
    nome: `Ajuste — ${t.descricao}`.slice(0, 200),
    contem: [t.descricao],
    aplicaEm: 'credito',
    valorExato: t.valor,
    acao: {
      ...acaoOriginal,
      tela: 'recebimento_contribuicao',
      matricula: sugestao.matricula,
      mesReferencia: sugestao.mesReferencia,
      ajustarParaValorRecebido: true,
    },
  };
  botao.disabled = true;
  try {
    const resp = await fetch('/economia/tesouraria/api/regras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regra }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao salvar o ajuste.');
    botao.textContent = '✓ Ajuste salvo — use "Rodar novamente só os que falharam"';
  } catch (e) {
    alert(e.message);
    botao.disabled = false;
  }
}

function montarPainelItensComErro(itensComErro) {
  const painel = document.createElement('div');
  painel.className = 'painel-itens-com-erro';

  const titulo = document.createElement('div');
  titulo.className = 'titulo-itens-com-erro';
  titulo.textContent = `${itensComErro.length} transação(ões) não lançada(s):`;
  painel.appendChild(titulo);

  for (const { indice, motivo, sugestaoRecibo } of itensComErro) {
    const item = planoAtual[indice];
    const linha = document.createElement('div');
    linha.className = 'log-linha log-erro';
    if (!item) {
      linha.textContent = `[índice ${indice}] ${motivo}`;
      painel.appendChild(linha);
      continue;
    }
    const t = item.transacao;
    const sinal = t.tipo === 'credito' ? '+' : '−';
    linha.innerHTML = `
      <div>${escaparHtml(t.data)}  ${sinal} R$ ${formatarMoeda(t.valor)}  ${escaparHtml(t.descricao)}</div>
      <div class="log-motivo">Erro: ${escaparHtml(motivo)}</div>
    `;
    const botaoRegra = document.createElement('button');
    botaoRegra.type = 'button';
    botaoRegra.className = 'botao-link';
    botaoRegra.textContent = item.temRegra ? 'Editar regra' : 'Criar regra';
    botaoRegra.addEventListener('click', () => {
      if (item.temRegra) abrirModalEditarRegra(indice).catch((err) => alert(`Não consegui abrir o formulário de regra: ${err.message}`));
      else abrirModalCriarRegra(indice).catch((err) => alert(`Não consegui abrir o formulário de regra: ${err.message}`));
    });
    linha.appendChild(botaoRegra);
    if (sugestaoRecibo && sugestaoRecibo.podeAjustar) {
      const botaoAjustar = document.createElement('button');
      botaoAjustar.type = 'button';
      botaoAjustar.className = 'botao-link botao-ajustar-contribuicao';
      botaoAjustar.textContent = `Ajustar a contribuição para R$ ${formatarMoeda(sugestaoRecibo.valorRecebido)}`;
      botaoAjustar.addEventListener('click', () => ajustarContribuicaoParaValorRecebido(indice, sugestaoRecibo, botaoAjustar));
      linha.appendChild(botaoAjustar);
    }
    if (sugestaoRecibo && sugestaoRecibo.sobra) {
      const botaoItens = document.createElement('button');
      botaoItens.type = 'button';
      botaoItens.className = 'botao-link botao-mais-itens';
      botaoItens.textContent = 'Adicionar mais itens ao recibo';
      botaoItens.addEventListener('click', () => abrirReciboComMaisItens(indice, sugestaoRecibo)
        .catch((err) => alert(`Não consegui abrir o formulário: ${err.message}`)));
      linha.appendChild(botaoItens);
    }
    painel.appendChild(linha);
  }

  const botaoRodarFalhas = document.createElement('button');
  botaoRodarFalhas.type = 'button';
  botaoRodarFalhas.className = 'botao-secundario';
  botaoRodarFalhas.textContent = `Rodar novamente só os que falharam (${itensComErro.length})`;
  botaoRodarFalhas.addEventListener('click', () => iniciarLancamento(itensComErro.map((i) => i.indice)));
  painel.appendChild(botaoRodarFalhas);

  return painel;
}

// Painel de conferência de saldo (Mercúrio x extrato) — só aparece quando
// o extrato trouxe saldo por dia (CSV com coluna "saldo") E o Mercúrio
// calculou um saldo diferente pra algum desses dias. Pedido do usuário:
// avisar explicitamente e dar 2 caminhos — ver o que reverter, ou só
// seguir ciente de que pode haver diferença de caixa.
function mostrarConciliacaoSaldo(mensagem, diferencas) {
  const linhas = diferencas.map((d) => `
    <div class="detalhe">${escaparHtml(d.data)} (${escaparHtml(d.caixa)}): Mercúrio R$ ${formatarMoeda(d.saldoMercurio)} vs. extrato R$ ${formatarMoeda(d.saldoExtrato)} (diferença R$ ${formatarMoeda(Math.abs(d.diferenca))})</div>
  `).join('');

  conciliacaoSaldo.hidden = false;
  conciliacaoSaldo.innerHTML = `
    <div class="titulo">⚠ ${escaparHtml(mensagem)}</div>
    ${linhas}
    <div class="botoes">
      <button id="btnEstornarPorDiferenca" class="botao-perigo">Ver lançamentos desta rodada (pra reverter manualmente)</button>
      <button id="btnCienteDiferenca" class="botao-secundario">Ciente — só vou conferir manualmente</button>
    </div>
  `;
  document.getElementById('btnEstornarPorDiferenca').addEventListener('click', () => {
    mostrarListaLancamentos(ultimoResultadoLancamento ? ultimoResultadoLancamento.itensLancados : []);
  });
  document.getElementById('btnCienteDiferenca').addEventListener('click', () => {
    conciliacaoSaldo.hidden = true;
  });
}

// Reversão automática ainda NÃO existe — preciso ver como o Mercúrio
// permite estornar/cancelar um lançamento já FINALIZADO (diferente do
// "Excluir" que só funciona num item ainda pendente, dentro do próprio
// Recibo, antes de "Finalizar com/sem Recibo") antes de automatizar isso
// com segurança. Enquanto isso, lista o que foi lançado nesta rodada com
// detalhe suficiente pra reverter manualmente no Mercúrio.
function mostrarListaLancamentos(itensLancados) {
  listaLancamentosRodada.hidden = false;
  if (!itensLancados || itensLancados.length === 0) {
    listaLancamentosRodada.innerHTML = '<div class="log-linha">Nenhum lançamento nesta rodada.</div>';
    return;
  }
  const linhas = itensLancados.map(({ transacao: t, acao, caixa }) => {
    const sinal = t.tipo === 'credito' ? '+' : '−';
    const detalhe = acao.tela === 'recebimento_contribuicao'
      ? `matrícula ${escaparHtml(acao.matricula)}`
      : acao.tela === 'recebimento_composto'
        ? `${(acao.itens || []).length} itens no mesmo recibo`
        : acao.tela === 'transferencia'
        ? (t.tipo === 'credito' ? `vindo do caixa "${escaparHtml(acao.caixaOutro)}"` : `para o caixa "${escaparHtml(acao.caixaOutro)}"`)
        : `rubrica "${escaparHtml(acao.rubricaNome || acao.rubricaId)}"`;
    return `<div class="log-linha">
      ${escaparHtml(t.data)}  ${sinal} R$ ${formatarMoeda(t.valor)}  ${escaparHtml(t.descricao)}
      <div class="log-motivo">via ${escaparHtml(nomeTelaLocal(acao.tela))}, ${detalhe} — caixa "${escaparHtml(caixa)}"</div>
    </div>`;
  }).join('');
  listaLancamentosRodada.innerHTML = `
    <div class="log-linha"><strong>Reversão automática ainda não está disponível</strong> — reverta cada item abaixo manualmente no Mercúrio (abra o dia/caixa certo e procure o lançamento pelo valor/descrição).</div>
    ${linhas}
  `;
  listaLancamentosRodada.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
