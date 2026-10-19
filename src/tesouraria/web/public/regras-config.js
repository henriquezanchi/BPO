/* eslint-disable -- script da tela da Tesouraria (código original, roda direto no navegador) */
// Tela de configuração de regras — ver, buscar, criar, editar, ativar/
// desativar, excluir, exportar e importar TODAS as regras, sem precisar
// carregar um extrato (pedido do usuário, 10/10/2026). Usa as mesmas rotas
// do formulário de regra do plano (POST /api/regras, /editar, /excluir) e
// mais GET /api/regras, /api/regras/exportar e POST /api/regras/importar.
//
// Roda depois de app.js e usa dele: escaparHtml, formatarMoeda,
// carregarRubricasSeNecessario, rubricasCache,
// acharIdRubricaPagamentoPeloNomeDigitado, caixasDisponiveis, planoAtual,
// regerarPlanoAposMudarRegras, nomeTelaLocal.

(() => {
  const $ = (id) => document.getElementById(id);
  const modal = $('modalConfigRegras');
  const visaoLista = $('cfgVisaoLista');
  const visaoForm = $('cfgVisaoForm');
  const corpo = $('cfgCorpoTabela');
  const busca = $('cfgBusca');
  const status = $('cfgStatus');
  const erro = $('cfgErro');

  let regras = [];
  let indiceEmEdicao = null; // null = criando
  let regrasMudaram = false;
  let importacaoPendente = null;

  function normalizar(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  }

  function textoAplicaEm(r) {
    if (r.aplicaEm === 'credito') return 'Entradas';
    if (r.aplicaEm === 'debito') return 'Saídas';
    return 'Entradas e saídas';
  }

  function textoAcao(r) {
    const a = r.acao || {};
    let detalhe = '';
    if (a.tela === 'recebimento_contribuicao') detalhe = `matrícula ${a.matricula || '?'}${a.mesReferencia ? ` / mês ${a.mesReferencia}` : ''}`;
    else if (a.tela === 'transferencia') detalhe = `outro caixa: ${a.caixaOutro || '?'}`;
    else if (a.tela === 'recebimento_composto') detalhe = (a.itens || []).map((i) => (i.tipo === 'contribuicao' ? `contribuição ${i.matricula} ${i.mesReferencia}` : (i.rubricaNome || i.tipo)) + ` R$ ${formatarMoeda(i.valor)}`).join('; ');
    else detalhe = a.rubricaNome || a.rubricaId || '';
    return { tela: nomeTelaLocal(a.tela), detalhe };
  }

  function mostrarStatus(texto) {
    status.textContent = texto;
  }

  async function carregar() {
    mostrarStatus('Carregando regras...');
    try {
      const resp = await fetch('/economia/tesouraria/api/regras');
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || 'Erro ao carregar as regras.');
      regras = dados.regras;
      mostrarStatus('');
      renderizar();
    } catch (e) {
      mostrarStatus(e.message);
    }
  }

  function renderizar() {
    const termo = normalizar(busca.value.trim());
    const visiveis = regras.filter((r) => {
      if (!termo) return true;
      const a = r.acao || {};
      const alvo = normalizar([r.nome, ...(r.contem || []), a.rubricaNome, a.matricula, a.caixaOutro, a.interessado].join(' '));
      return alvo.includes(termo);
    });
    if (regras.length === 0) {
      corpo.innerHTML = '<tr><td colspan="7" class="texto-secundario">Nenhuma regra ainda. Crie em "+ Nova regra" ou a partir de uma transação do extrato.</td></tr>';
      return;
    }
    if (visiveis.length === 0) {
      corpo.innerHTML = '<tr><td colspan="7" class="texto-secundario">Nenhuma regra encontrada para essa busca.</td></tr>';
      return;
    }
    corpo.innerHTML = visiveis.map((r) => {
      const { tela, detalhe } = textoAcao(r);
      const valor = r.valorExato ? `só R$ ${formatarMoeda(r.valorExato)}` : 'qualquer';
      return `<tr class="${r.ativa ? '' : 'cfg-inativa'}">
        <td><input type="checkbox" class="cfg-ativa" data-indice="${r.indice}" ${r.ativa ? 'checked' : ''} aria-label="Regra ativa"></td>
        <td>${escaparHtml(r.nome)}</td>
        <td>${(r.contem || []).map(escaparHtml).join(', ')}</td>
        <td>${textoAplicaEm(r)}</td>
        <td>${escaparHtml(tela)}<div class="detalhe-acao">${escaparHtml(detalhe)}</div></td>
        <td>${valor}</td>
        <td class="cfg-acoes">
          <button type="button" class="botao-link cfg-editar" data-indice="${r.indice}">Editar</button>
          <button type="button" class="botao-link cfg-excluir" data-indice="${r.indice}">Excluir</button>
        </td>
      </tr>`;
    }).join('');
  }

  function regraPorIndice(indice) {
    return regras.find((r) => r.indice === indice);
  }

  // Corpo enviado ao servidor — mesmo formato do formulário do plano.
  function semIndice(r) {
    const { indice, ...resto } = r;
    return resto;
  }

  async function salvarRegra(regra, indice) {
    const editando = indice !== null && indice !== undefined;
    const resp = await fetch(editando ? '/economia/tesouraria/api/regras/editar' : '/economia/tesouraria/api/regras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editando ? { indice, regra } : { regra }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao salvar a regra.');
    regrasMudaram = true;
  }

  // --- Abrir / fechar ---------------------------------------------------------

  async function abrir() {
    modal.hidden = false;
    mostrarLista();
    await carregar();
    busca.focus();
  }

  async function fechar() {
    modal.hidden = true;
    importacaoPendente = null;
    $('cfgImportacao').hidden = true;
    if (regrasMudaram && typeof planoAtual !== 'undefined' && planoAtual) {
      regrasMudaram = false;
      await regerarPlanoAposMudarRegras();
    }
    regrasMudaram = false;
  }

  function mostrarLista() {
    visaoForm.hidden = true;
    visaoLista.hidden = false;
    $('modalConfigRegrasTitulo').textContent = 'Regras';
  }

  $('btnAbrirConfigRegras').addEventListener('click', abrir);

  $('btnFecharConfigRegras').addEventListener('click', fechar);
  modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) fechar(); });
  busca.addEventListener('input', renderizar);

  // --- Lista: ativar/desativar, editar, excluir -------------------------------

  corpo.addEventListener('change', async (e) => {
    const caixa = e.target.closest('.cfg-ativa');
    if (!caixa) return;
    const r = regraPorIndice(Number(caixa.dataset.indice));
    if (!r) return;
    caixa.disabled = true;
    try {
      await salvarRegra({ ...semIndice(r), ativa: caixa.checked }, r.indice);
      r.ativa = caixa.checked;
      mostrarStatus(`Regra "${r.nome}" ${r.ativa ? 'ativada' : 'desativada'}.`);
      renderizar();
    } catch (err) {
      caixa.checked = !caixa.checked;
      mostrarStatus(err.message);
    } finally {
      caixa.disabled = false;
    }
  });

  corpo.addEventListener('click', async (e) => {
    const editar = e.target.closest('.cfg-editar');
    const excluir = e.target.closest('.cfg-excluir');
    if (editar) return abrirForm(regraPorIndice(Number(editar.dataset.indice)));
    if (!excluir) return;
    const r = regraPorIndice(Number(excluir.dataset.indice));
    if (!r || !confirm(`Excluir a regra "${r.nome}"? As transações que ela pegava voltam a aparecer como SEM REGRA.`)) return;
    try {
      const resp = await fetch('/economia/tesouraria/api/regras/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indice: r.indice }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || 'Erro ao excluir.');
      regrasMudaram = true;
      await carregar();
      mostrarStatus(`Regra "${r.nome}" excluída.`);
    } catch (err) {
      mostrarStatus(err.message);
    }
  });

  // --- Formulário (criar/editar) ----------------------------------------------

  function atualizarCamposForm() {
    const tela = $('cfgTela').value;
    visaoForm.querySelectorAll('[data-cfg-tela]').forEach((el) => {
      el.hidden = !el.dataset.cfgTela.split(' ').includes(tela);
    });
    $('cfgRubricaAvulso').setAttribute('list', tela === 'recebimento_inscricao' ? 'listaRubricasInscricao' : 'listaRubricasAvulso');
  }
  $('cfgTela').addEventListener('change', atualizarCamposForm);
  $('cfgValorExato').addEventListener('focus', () => { $('cfgValorExatoModo').checked = true; });

  async function abrirForm(r) {
    if (r && r.acao && r.acao.tela === 'recebimento_composto') {
      mostrarStatus(`"${r.nome}" é um recibo com vários itens — edite pelo botão "Editar regra" na transação do extrato (precisa do valor do Pix para conferir a soma). Aqui dá para ativar/desativar ou excluir.`);
      return;
    }
    indiceEmEdicao = r ? r.indice : null;
    erro.hidden = true;
    $('cfgFormTitulo').textContent = r ? 'Editar regra' : 'Nova regra';
    $('modalConfigRegrasTitulo').textContent = r ? 'Editar regra' : 'Nova regra';
    const a = (r && r.acao) || {};
    $('cfgNome').value = r ? r.nome : '';
    $('cfgContem').value = r ? (r.contem || []).join(', ') : '';
    $('cfgAplicaEm').value = r ? (r.aplicaEm || '') : 'debito';
    $('cfgValorExatoModo').checked = Boolean(r && r.valorExato);
    $('cfgValorQualquer').checked = !(r && r.valorExato);
    $('cfgValorExato').value = r && r.valorExato ? formatarMoeda(r.valorExato) : '';
    $('cfgTela').value = a.tela || 'pagamento_outros';
    $('cfgMatricula').value = a.matricula || '';
    $('cfgMes').value = a.mesReferencia || '';
    $('cfgRubricaPagamento').value = a.tela === 'pagamento_outros' ? (a.rubricaNome || '') : '';
    $('cfgRubricaAvulso').value = (a.tela === 'recebimento_avulso' || a.tela === 'recebimento_inscricao') ? (a.rubricaNome || '') : '';
    $('cfgCaixaOutro').value = a.caixaOutro || '';
    $('cfgInteressado').value = a.interessado || '';
    $('cfgComplemento').value = a.complemento || '';
    $('cfgEmitirRecibo').checked = Boolean(a.emitirRecibo);
    $('cfgAtiva').checked = r ? r.ativa : true;
    $('cfgListaCaixas').innerHTML = (typeof caixasDisponiveis !== 'undefined' ? caixasDisponiveis : [])
      .map((c) => `<option value="${escaparHtml(c)}"></option>`).join('');
    atualizarCamposForm();

    visaoLista.hidden = true;
    visaoForm.hidden = false;
    $('cfgNome').focus();

    try {
      const cache = await carregarRubricasSeNecessario();
      $('cfgRubricaDoacao').innerHTML = cache.doacao.map((d) => `<option value="${d.id}">${escaparHtml(d.nome)}</option>`).join('');
      if (a.tela === 'recebimento_doacao' && a.rubricaId) $('cfgRubricaDoacao').value = a.rubricaId;
    } catch (e) {
      mostrarErro(`Não consegui carregar a lista de rubricas: ${e.message}`);
    }
  }

  function mostrarErro(msg) {
    erro.hidden = false;
    erro.textContent = msg;
  }

  function lerValor(texto) {
    const limpo = String(texto).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const v = Number(limpo);
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
  }

  function montarRegraDoForm() {
    const nome = $('cfgNome').value.trim();
    const contem = $('cfgContem').value.split(',').map((p) => p.trim()).filter(Boolean);
    const tela = $('cfgTela').value;
    if (!nome) throw new Error('Dê um nome pra essa regra.');
    if (contem.length === 0) throw new Error('Informe ao menos uma palavra-chave em "Contém".');

    let valorExato = null;
    if ($('cfgValorExatoModo').checked) {
      valorExato = lerValor($('cfgValorExato').value);
      if (!(valorExato > 0)) throw new Error('Informe o valor exato (ex: 45,10) ou escolha "Qualquer valor".');
    }

    const acao = { tela };
    if (tela === 'recebimento_contribuicao') {
      acao.matricula = $('cfgMatricula').value.trim();
      if (!acao.matricula) throw new Error('Matrícula é obrigatória para Recebimento > Contribuições.');
      if ($('cfgMes').value.trim()) acao.mesReferencia = $('cfgMes').value.trim();
    } else if (tela === 'pagamento_outros') {
      const id = acharIdRubricaPagamentoPeloNomeDigitado($('cfgRubricaPagamento').value);
      if (!id) throw new Error('Escolha uma rubrica válida da lista (digite um trecho e escolha uma sugestão).');
      acao.rubricaId = id;
      acao.rubricaNome = $('cfgRubricaPagamento').value.trim();
    } else if (tela === 'recebimento_doacao') {
      const sel = $('cfgRubricaDoacao');
      if (!sel.value) throw new Error('Escolha o tipo de doação.');
      acao.rubricaId = sel.value;
      acao.rubricaNome = sel.options[sel.selectedIndex].textContent;
    } else if (tela === 'recebimento_avulso' || tela === 'recebimento_inscricao') {
      acao.rubricaNome = $('cfgRubricaAvulso').value.trim();
      if (!acao.rubricaNome) throw new Error('Informe o nome exato da rubrica.');
    } else if (tela === 'transferencia') {
      acao.caixaOutro = $('cfgCaixaOutro').value.trim();
      if (!acao.caixaOutro) throw new Error('Informe o outro caixa da transferência.');
    }
    if (tela !== 'transferencia') {
      if ($('cfgInteressado').value.trim()) acao.interessado = $('cfgInteressado').value.trim();
      if ($('cfgComplemento').value.trim()) acao.complemento = $('cfgComplemento').value.trim();
    }
    if (tela !== 'pagamento_outros' && tela !== 'transferencia') acao.emitirRecibo = $('cfgEmitirRecibo').checked;

    return {
      nome,
      contem,
      aplicaEm: $('cfgAplicaEm').value || null,
      valorExato,
      ativa: $('cfgAtiva').checked,
      acao,
    };
  }

  visaoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.hidden = true;
    let regra;
    try {
      regra = montarRegraDoForm();
    } catch (err) {
      return mostrarErro(err.message);
    }
    const botao = $('cfgSalvar');
    botao.disabled = true;
    try {
      await salvarRegra(regra, indiceEmEdicao);
      mostrarLista();
      await carregar();
      mostrarStatus(`Regra "${regra.nome}" salva.`);
    } catch (err) {
      mostrarErro(err.message);
    } finally {
      botao.disabled = false;
    }
  });

  $('cfgCancelarForm').addEventListener('click', mostrarLista);
  $('cfgNova').addEventListener('click', () => abrirForm(null));

  // --- Exportar / importar ----------------------------------------------------

  $('cfgExportar').addEventListener('click', () => {
    // Link direto: o servidor responde com Content-Disposition (download).
    const a = document.createElement('a');
    a.href = '/economia/tesouraria/api/regras/exportar';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  $('cfgImportar').addEventListener('click', () => $('cfgArquivoImportar').click());

  $('cfgArquivoImportar').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const json = JSON.parse(await arquivo.text());
      const lista = Array.isArray(json) ? json : json.regras;
      if (!Array.isArray(lista) || lista.length === 0) throw new Error('Esse arquivo não tem uma lista de regras.');
      importacaoPendente = lista;
      $('cfgImportacaoTexto').textContent = `"${arquivo.name}": ${lista.length} regra(s). Hoje existem ${regras.length}.`;
      $('cfgImportacao').hidden = false;
    } catch (err) {
      mostrarStatus(`Não consegui ler o arquivo: ${err.message}`);
    }
  });

  async function importar(modo) {
    if (!importacaoPendente) return;
    if (modo === 'substituir' && !confirm(`Substituir TODAS as ${regras.length} regras atuais pelas ${importacaoPendente.length} do arquivo? As atuais serão apagadas.`)) return;
    try {
      const resp = await fetch('/economia/tesouraria/api/regras/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regras: importacaoPendente, modo }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || 'Erro ao importar.');
      regrasMudaram = true;
      importacaoPendente = null;
      $('cfgImportacao').hidden = true;
      await carregar();
      mostrarStatus(`${dados.importadas} regra(s) importada(s). Total agora: ${dados.totalRegras}.`);
    } catch (err) {
      mostrarStatus(err.message);
    }
  }
  $('cfgImportarSubstituir').addEventListener('click', () => importar('substituir'));
  $('cfgImportarAcrescentar').addEventListener('click', () => importar('acrescentar'));
  $('cfgImportarCancelar').addEventListener('click', () => {
    importacaoPendente = null;
    $('cfgImportacao').hidden = true;
  });
})();
