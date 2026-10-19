// Rotas do servidor — tela de revisão visual do plano de importação (modo
// de conferência) e, quando o usuário pedir explicitamente, o lançamento
// real no Mercúrio com acompanhamento ao vivo. Mesmo motor do CLI
// (lib/executor.js, lib/plano.js) — só a forma de mostrar/perguntar muda
// (Server-Sent Events + botão na página, em vez de console/readline).
//
// Usado por 2 portas de entrada, com o MESMO código:
//   - web/servidor.js — servidor local (pasta portátil, "npm run web");
//   - api/index.js — função da Vercel (site online).
// O que muda entre os dois fica em lib/armazenamento.js (disco/memória x
// Redis) e em emSegundoPlano() abaixo.

import fs from 'node:fs';
import path from 'node:path';
import { lerExtratoDeConteudo } from '../lib/parsers.js';
import { prepararRegras } from '../lib/regras.js';
import { montarPlano, detalheAcao, resumoPlano, nomeTela } from '../lib/plano.js';
import { validarEnv, resolverFilial, resolverCaixa } from '../lib/configuracao.js';
import { rubricasDoTexto, atualizarTextoRubricas } from '../lib/rubricas.js';
import { adicionarRegra, editarRegra, removerRegra, importarRegras } from '../lib/regrasEditor.js';
import { dataHojeBR } from '../lib/formato.js';
import {
  lerTexto, gravarTexto, lerJson, gravarJson, lerValor, gravarValor,
  novoIdJob, registrarJob, jobExiste, adicionarEvento, lerEventos, ouvirEventosLocais,
  tentarTravar, liberarTrava, USANDO_REDIS,
} from '../lib/armazenamento.js';
import { tratarAutenticacao } from './autenticacao.js';

// Dentro do Portal (empacotado pelo Next), import.meta.url não aponta pra pasta
// original — os arquivos da tela e o logo são achados a partir da raiz do projeto.
const PASTA_PUBLIC = path.join(process.cwd(), 'src', 'tesouraria', 'web', 'public');
const ARQUIVO_LOGO = path.join(process.cwd(), 'public', 'na-logo.png');

const ARQ_REGRAS = 'regras.json';
const ARQ_RUBRICAS_PAGAMENTO = 'RUBRICAS_PAGAMENTO.md';
const ARQ_RUBRICAS_DOACAO = 'RUBRICAS_DOACAO.md';

const TIPOS_CONTEUDO = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
};

// O navegador roda invisível por padrão — só fica visível se
// HEADLESS_DEBUG=false no .env (depuração local pontual, ex: um seletor
// quebrou e você precisa ver a tela pra entender o que mudou no Mercúrio).
// Na Vercel é sempre invisível (ver lib/mercurioAuth.js).
const HEADLESS = process.env.HEADLESS_DEBUG !== 'false';

// --- Tempo máximo na Vercel -------------------------------------------------
// A função tem no máximo 800s (vercel.json, plano Pro). O lote para de
// iniciar transações novas com folga antes disso (conferência de saldo e
// fechar o navegador ainda precisam de tempo) — ver `prazo` em
// lib/executor.js. Localmente não há limite.
const NA_VERCEL = Boolean(process.env.VERCEL);
const PRAZO_RODADA_MS = 660 * 1000;
const VALIDADE_TRAVA_S = 900;
// Operações curtas (listar filiais/caixas, buscar um aluno) levam segundos.
// Se uma travar, ela é encerrada em LIMITE_OPERACAO_CURTA_MS (o navegador é
// fechado) e a trava da matrícula nunca fica presa mais que alguns minutos
// — antes valia a mesma trava de 15 min dos lotes, e uma listagem pendurada
// bloqueava a pessoa por 15 min.
const VALIDADE_TRAVA_CURTA_S = 180;
const LIMITE_OPERACAO_CURTA_MS = 150 * 1000;
const DURACAO_MAX_STREAM_MS = 760 * 1000;

function prazoDaRodada() {
  return NA_VERCEL ? Date.now() + PRAZO_RODADA_MS : null;
}

// Na Vercel, trabalho que continua depois da resposta precisa ser
// registrado com waitUntil() — senão a função pode ser congelada assim que
// a resposta sai. Localmente o processo fica de pé de qualquer jeito.
async function emSegundoPlano(promessa) {
  if (!NA_VERCEL) return;
  const { waitUntil } = await import('@vercel/functions');
  waitUntil(promessa);
}

const MSG_OCUPADO = 'Outra operação sua no Mercúrio ainda está em andamento (por exemplo, a verificação de duplicidade). Assim que ela terminar, tente de novo.';

// --- Jobs (lançar, verificar, rubricas, busca em lote) ----------------------

// Grava os eventos de um job NA ORDEM em que foram emitidos — os módulos de
// lib/ chamam log() de forma síncrona, e no modo Redis cada gravação é uma
// ida à rede; a fila evita que um evento ultrapasse o anterior.
//
// Histórico do bug de "Failed to fetch" (15/09/2026): escrever num cliente
// SSE cuja conexão já caiu derrubava o processo inteiro. Agora quem escreve
// em cada conexão é só o handler do /stream (com try/catch e listener de
// 'error'); o job em si só grava eventos no armazenamento e nunca toca em
// socket nenhum.
function criarEmissor(id) {
  let fila = Promise.resolve();
  return {
    emitir(evento) {
      fila = fila.then(() => adicionarEvento(id, evento)).catch((e) => {
        console.error(`[job ${id}] falha ao gravar evento:`, e.message);
      });
    },
    esvaziar: () => fila,
  };
}

// Abre um job em segundo plano e responde na hora com o jobId — a tela
// acompanha por GET /api/job/:id/stream. `executar(emitir, prazo)` é o
// trabalho em si.
async function iniciarJob(res, matricula, executar) {
  const id = novoIdJob();
  if (!(await tentarTravar(matricula, id, VALIDADE_TRAVA_S))) return enviarJson(res, 409, { erro: MSG_OCUPADO });
  await registrarJob(id);
  const { emitir, esvaziar } = criarEmissor(id);

  const tarefa = (async () => {
    try {
      await executar(emitir, prazoDaRodada());
    } catch (e) {
      emitir({ tipo: 'erro_fatal', mensagem: e.message });
    } finally {
      emitir({ tipo: 'fim_stream' });
      await esvaziar();
      await liberarTrava(matricula, id);
    }
  })();
  await emSegundoPlano(tarefa);
  return enviarJson(res, 200, { jobId: id });
}

// Operação curta, respondida na mesma requisição (listar filiais/caixas,
// buscar um aluno) — mesma trava de "uma por vez".
async function comTrava(res, matricula, executar) {
  const dono = `curta-${novoIdJob()}`;
  if (!(await tentarTravar(matricula, dono, VALIDADE_TRAVA_CURTA_S))) return enviarJson(res, 409, { erro: MSG_OCUPADO });
  try {
    return await executar();
  } finally {
    await liberarTrava(matricula, dono);
  }
}

// Falha do próprio navegador no servidor (não do Mercúrio) — numa operação
// curta, vale tentar de novo uma vez com um navegador novo.
const ERRO_DE_RECURSO = /ERR_INSUFFICIENT_RESOURCES|has been closed|disconnected|Target crashed/i;

async function comNavegadorNaTesouraria(credenciais, nomeFilial, trabalho, opcoes = {}) {
  try {
    return await umaVezNaTesouraria(credenciais, nomeFilial, trabalho, opcoes);
  } catch (e) {
    if (!opcoes.limiteMs || !ERRO_DE_RECURSO.test(e.message)) throw e;
    console.log('[navegador] falta de recurso — tentando de novo:', e.message.split('\n')[0]);
    try {
      return await umaVezNaTesouraria(credenciais, nomeFilial, trabalho, opcoes);
    } catch (e2) {
      if (ERRO_DE_RECURSO.test(e2.message)) {
        throw new Error('O servidor está sem recursos para abrir o Mercúrio agora. Espere alguns segundos e tente de novo.');
      }
      throw e2;
    }
  }
}

async function umaVezNaTesouraria(credenciais, nomeFilial, trabalho, { limiteMs } = {}) {
  const { abrirNavegador, login, abrirTesourariaDaFilial } = await import('../lib/mercurioAuth.js');
  const { browser, page } = await abrirNavegador({ headless: HEADLESS });
  const tarefa = (async () => {
    await login(page, credenciais.matricula, credenciais.senha);
    const info = nomeFilial ? await abrirTesourariaDaFilial(page, nomeFilial) : {};
    return trabalho(page, info || {});
  })();
  let relogio;
  try {
    if (!limiteMs) return await tarefa;
    return await Promise.race([
      tarefa,
      new Promise((_, rejeitar) => {
        relogio = setTimeout(() => rejeitar(new Error('O Mercúrio demorou demais para responder. Tente de novo em instantes.')), limiteMs);
      }),
    ]);
  } finally {
    clearTimeout(relogio);
    tarefa.catch(() => {}); // se estourou o tempo, o erro dela não importa mais
    await browser.close();
  }
}

async function jobLancamento(emitir, prazo, plano, credenciais, filial, caixaPadrao, apenasIndices) {
  const { executarPlano } = await import('../lib/executor.js');
  await executarPlano(plano, {
    headless: HEADLESS,
    credenciais,
    filial,
    caixaPadrao,
    apenasIndices,
    prazo,
    log: emitir,
    env: process.env,
  });
}

// Job de verificação — só leitura, nunca lança nada, nunca pergunta nada
// (não há decisão a tomar, só relatar o que já existe no Mercúrio).
async function jobVerificacao(emitir, prazo, plano, credenciais, filial, caixaPadrao) {
  const { verificarDuplicatas } = await import('../lib/executor.js');
  await verificarDuplicatas(plano, {
    headless: HEADLESS,
    credenciais,
    filial,
    caixaPadrao,
    prazo,
    log: emitir,
    env: process.env,
  });
}

// Job de atualização do catálogo de rubricas — loga, lê os 4 catálogos
// reais (Pagamento Outros / Doações / Avulsos / Inscrições) e regrava os
// .md de Pagamento Outros/Doações; Avulsos/Inscrições não têm "id" nenhum
// pra justificar um .md (ver importarRubricasRecebimentoExtra() em
// lib/mercurioTesouraria.js) — ficam guardados só como lista de nomes pra
// alimentar a sugestão (datalist) do formulário. Nunca lança nada.
async function jobAtualizarRubricas(emitir, credenciais, filial, caixa) {
  const { importarRubricasDoMercurio, importarRubricasRecebimentoExtra, lerComposicaoContribuicoes } = await import('../lib/mercurioTesouraria.js');
  const nomeFilial = resolverFilial(filial, process.env);
  emitir({ tipo: 'status', mensagem: 'Entrando no Mercúrio para ler as rubricas...' });
  await comNavegadorNaTesouraria(credenciais, nomeFilial, async (page) => {
    emitir({ tipo: 'status', mensagem: `Lendo rubricas de "${nomeFilial}"...` });
    const nomeCaixa = resolverCaixa(null, caixa, process.env);
    const { pagamento, doacao } = await importarRubricasDoMercurio(page, nomeCaixa, dataHojeBR());
    await gravarTexto(ARQ_RUBRICAS_PAGAMENTO, atualizarTextoRubricas(await lerTexto(ARQ_RUBRICAS_PAGAMENTO), pagamento));
    await gravarTexto(ARQ_RUBRICAS_DOACAO, atualizarTextoRubricas(await lerTexto(ARQ_RUBRICAS_DOACAO), doacao));

    emitir({ tipo: 'status', mensagem: 'Lendo rubricas de Avulsos/Inscrições...' });
    const { avulso, inscricao } = await importarRubricasRecebimentoExtra(page, nomeCaixa, dataHojeBR());
    await gravarValor('rubricasExtra', { avulso, inscricao });

    // Composição das contribuições (ativos + valor de cada um) — mesma ida
    // ao Mercúrio. Melhor esforço: se falhar, as rubricas já valem.
    let totalAlunos = null;
    try {
      emitir({ tipo: 'status', mensagem: 'Lendo a composição das contribuições...' });
      const alunos = await lerComposicaoContribuicoes(page);
      await gravarValor(`composicao:${nomeFilial}`, { lidaEm: Date.now(), alunos });
      totalAlunos = alunos.length;
    } catch (e) {
      console.log('[composição] não consegui ler:', e.message);
    }

    emitir({
      tipo: 'rubricas_atualizadas',
      totalPagamento: pagamento.length,
      totalDoacao: doacao.length,
      totalAvulso: avulso.length,
      totalInscricao: inscricao.length,
      totalAlunos,
    });
  });
}

// Job de busca em lote — loga UMA VEZ e busca vários nomes em sequência.
// Usa buscarAlunoPorNomeViaFichas() (Cadastro → Fichas, lista de alunos
// ativos já com matrícula ao lado do nome) — não abre dia/caixa nenhum
// pra buscar, então nem precisa mais reabrir nada entre um nome e outro.
//
// Achou a matrícula → já cria a regra na hora (pedido do usuário: antes
// era preciso, DEPOIS da busca, clicar em "Criar regra (matrícula X
// encontrada)" linha por linha — agora a própria busca em lote já grava
// direto nas regras, com o mesmo "nome" usado na busca como palavra-
// chave/nome da regra e a matrícula achada). `nomesJaCriados` evita
// duplicar regra quando duas transações do MESMO extrato caem na mesma
// palavra-chave (ex: 2 Pix da mesma pessoa) — verifica tanto contra o que
// já existia ANTES desta rodada quanto contra o que esta própria rodada
// já criou.
async function jobBuscaAlunosLote(emitir, prazo, lista, credenciais, filial) {
  const { buscarAlunoPorNomeViaFichas } = await import('../lib/mercurioTesouraria.js');
  const { procurarNaComposicao } = await import('../lib/composicao.js');
  const nomeFilial = resolverFilial(filial, process.env);
  let encontrados = 0;
  let regrasCriadas = 0;

  const nomesJaCriados = new Set();
  try {
    for (const r of prepararRegras(await lerJson(ARQ_REGRAS, { regras: [] }))) {
      for (const p of r.contem || []) nomesJaCriados.add(p.trim().toUpperCase());
    }
  } catch {
    // Regras com problema — segue sem base de deduplicação prévia (só
    // evita duplicar DENTRO desta mesma rodada).
  }

  // Achou a matrícula → cria a regra na hora (mesmo comportamento de antes).
  async function registrar(indice, nome, resultado) {
    if (resultado.encontrado) {
      encontrados++;
      const chave = nome.trim().toUpperCase();
      if (!nomesJaCriados.has(chave)) {
        nomesJaCriados.add(chave);
        try {
          const json = await lerJson(ARQ_REGRAS, { regras: [] });
          adicionarRegra(json, {
            nome,
            contem: [nome],
            aplicaEm: 'credito',
            acao: {
              tela: 'recebimento_contribuicao',
              matricula: resultado.matricula,
              interessado: resultado.nomeConfirmado,
              emitirRecibo: false,
            },
          });
          await gravarJson(ARQ_REGRAS, json);
          regrasCriadas++;
          resultado.regraCriada = true;
        } catch (eRegra) {
          resultado.avisoRegra = `Matrícula encontrada, mas não consegui criar a regra sozinho: ${eRegra.message}`;
        }
      } else {
        resultado.avisoRegra = 'Já existe (ou já foi criada nesta rodada) uma regra com esta mesma palavra-chave.';
      }
    }
    emitir({ tipo: 'busca_item', indice, resultado });
  }

  // 1º: procura na Composição das contribuições (lista de ativos lida em
  // segundo plano) — na hora, sem abrir o Mercúrio. Só quem não for achado
  // ali (ou for ambíguo) vai para a busca no Mercúrio.
  const composicao = await lerValor(`composicao:${nomeFilial}`, { alunos: [] });
  const pendentes = [];
  for (const { indice, nome } of lista) {
    const candidatos = procurarNaComposicao(composicao.alunos, nome);
    if (candidatos.length === 1) {
      await registrar(indice, nome, { encontrado: true, matricula: candidatos[0].matricula, nomeConfirmado: candidatos[0].nome, valorContribuicao: candidatos[0].valor });
    } else {
      pendentes.push({ indice, nome });
    }
  }
  if (lista.length > pendentes.length) {
    emitir({ tipo: 'status', mensagem: `${lista.length - pendentes.length} nome(s) achado(s) na lista de ativos.` });
  }

  if (pendentes.length) {
    emitir({ tipo: 'status', mensagem: `Buscando ${pendentes.length} nome(s) no Mercúrio...` });
    await comNavegadorNaTesouraria(credenciais, nomeFilial, async (page) => {
      for (const { indice, nome } of pendentes) {
        if (prazo && Date.now() > prazo) {
          emitir({ tipo: 'busca_item', indice, resultado: { encontrado: false, motivo: 'erro', erro: 'Tempo máximo da rodada no servidor esgotado — rode a busca em lote de novo para os que faltaram.' } });
          continue;
        }
        try {
          await registrar(indice, nome, await buscarAlunoPorNomeViaFichas(page, nome));
        } catch (e) {
          emitir({ tipo: 'busca_item', indice, resultado: { encontrado: false, motivo: 'erro', erro: e.message } });
        }
      }
    });
  }
  emitir({ tipo: 'busca_lote_concluida', total: lista.length, encontrados, regrasCriadas });
}

// --- Helpers de request/response -----------------------------------------

function lerCorpoJson(req) {
  // A Vercel já entrega o corpo lido em req.body; localmente lemos o stream.
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.length ? JSON.parse(req.body.toString('utf-8')) : {});
    return Promise.resolve(req.body || {});
  }
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (c) => {
      dados += c;
      if (dados.length > 20 * 1024 * 1024) req.destroy(new Error('Corpo da requisição grande demais.'));
    });
    req.on('end', () => {
      try {
        resolve(dados ? JSON.parse(dados) : {});
      } catch {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });
    req.on('error', reject);
  });
}

function enviarJson(res, status, obj) {
  const corpo = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(corpo) });
  res.end(corpo);
}

function servirArquivoEstatico(res, caminhoArquivo) {
  fs.readFile(caminhoArquivo, (err, dados) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado');
      return;
    }
    const ext = path.extname(caminhoArquivo).toLowerCase();
    // Sem isso, o navegador pode continuar servindo uma cópia antiga do
    // HTML/CSS/JS do cache dele mesmo depois de atualizar o servidor. Este
    // projeto muda de código o tempo todo, então "sempre buscar fresco" é
    // mais importante aqui do que performance de cache.
    res.writeHead(200, {
      'Content-Type': TIPOS_CONTEUDO[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(dados);
  });
}

function exigirEnv() {
  const faltando = validarEnv(process.env);
  if (faltando.length) {
    throw new Error(`Configure as variáveis de ambiente antes (faltando: ${faltando.join(', ')}).`);
  }
}

// Monta o plano a partir do corpo já parseado da requisição — reaproveitado
// tanto por /api/plano (só revisão) quanto por /api/lancar (revisão de
// novo, no servidor, antes de abrir o navegador — nunca confia num plano
// vindo pronto do cliente). `caixasPorIndice` (opcional, {indice: nomeCaixa})
// é o override de caixa POR LINHA escolhido na tela — vira uma propriedade
// `caixa` na própria transação, que executarPlano()/verificarDuplicatas()
// já sabem priorizar sobre o caixa padrão do lote.
async function montarPlanoDoCorpo(corpo) {
  const { nomeArquivo, conteudo, caixasPorIndice } = corpo;
  if (!nomeArquivo || typeof conteudo !== 'string') {
    throw new Error('Envie "nomeArquivo" e "conteudo" (texto do extrato) no corpo da requisição.');
  }
  const transacoes = lerExtratoDeConteudo(nomeArquivo, conteudo);
  const regras = prepararRegras(await lerJson(ARQ_REGRAS, { regras: [] }));
  const plano = montarPlano(transacoes, regras);
  if (caixasPorIndice && typeof caixasPorIndice === 'object') {
    plano.forEach((item, indice) => {
      const caixa = caixasPorIndice[indice];
      if (caixa) item.transacao.caixa = caixa;
    });
  }
  return plano;
}

// Login individual (matrícula/senha) — vem do formulário na tela, pedido a
// cada rodada; NUNCA fica guardado neste servidor (só passa pela memória
// do processo enquanto aquele job roda). Se o navegador do usuário marcou
// "lembrar", quem guarda é o `localStorage` do PRÓPRIO navegador dele —
// o servidor nunca sabe disso, só recebe os valores prontos a cada request.
function exigirCredenciais(corpo) {
  const matricula = (corpo.credenciais && corpo.credenciais.matricula || '').trim();
  const senha = (corpo.credenciais && corpo.credenciais.senha || '').trim();
  if (!matricula || !senha) {
    throw new Error('Informe matrícula e senha do Mercúrio (login individual) no formulário antes de continuar.');
  }
  return { matricula, senha };
}

function serializarPlano(plano) {
  return plano.map((item) => ({
    transacao: item.transacao,
    temRegra: !!item.regra,
    nomeRegra: item.regra ? item.regra.nome : null,
    tela: item.acao ? item.acao.tela : null,
    nomeTela: item.acao ? nomeTela(item.acao.tela) : null,
    detalhe: item.acao ? detalheAcao(item) : null,
    // Dados extras só pra alimentar o botão "Editar regra" da tela — a
    // posição real da regra no arquivo (não a posição entre só as ativas)
    // e o conteúdo dela pronto pra pré-preencher o mesmo formulário de
    // "Criar regra".
    regraIndice: item.regra ? item.regra._indiceArquivo : null,
    regraContem: item.regra ? item.regra.contem : null,
    regraAplicaEm: item.regra ? (item.regra.aplicaEm || null) : null,
    regraValorExato: item.regra ? (item.regra.valorExato ?? null) : null,
    regraAcao: item.regra ? item.regra.acao : null,
  }));
}

// --- Stream de eventos de um job (SSE) --------------------------------------
// Cada evento sai com `id:` = sua posição — se a conexão cair (ou a Vercel
// encerrar a função do stream), a tela reconecta pedindo só o que faltou
// (?desde=N), sem repetir nada.
async function transmitirJob(req, res, id, url) {
  if (!(await jobExiste(id))) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let enviados = Number(url.searchParams.get('desde')) || Number(req.headers['last-event-id']) || 0;
  let aberto = true;
  let pararDeOuvir = null;
  const fechar = () => {
    if (!aberto) return;
    aberto = false;
    if (pararDeOuvir) pararDeOuvir();
    try { res.end(); } catch { /* conexão já caiu */ }
  };
  // 'error' precisa de um listener SEMPRE — sem isso, um problema no socket
  // (conexão caindo) derruba o processo inteiro sozinho.
  res.on('error', fechar);
  req.on('close', fechar);

  const escrever = (evento, posicao) => {
    if (!aberto || posicao <= enviados) return;
    try {
      res.write(`id: ${posicao}\ndata: ${JSON.stringify(evento)}\n\n`);
    } catch {
      fechar();
      return;
    }
    enviados = posicao;
    if (evento.tipo === 'fim_stream') fechar();
  };

  // Histórico primeiro (cobre o caso do cliente conectar um instante depois
  // do POST, ou reconectar no meio), depois os eventos novos.
  if (!USANDO_REDIS) {
    const base = enviados;
    const escuta = ouvirEventosLocais(id, base, escrever);
    if (!escuta) return fechar();
    pararDeOuvir = escuta.parar;
    escuta.historico.forEach((evento, i) => escrever(evento, base + i + 1));
    return;
  }
  const base = enviados;
  const historico = await lerEventos(id, base);
  historico.forEach((evento, i) => escrever(evento, base + i + 1));
  if (!aberto) return;

  // Modo Redis: o job pode estar rodando em outra instância — consulta os
  // eventos novos em intervalos curtos. Encerra antes do limite da função;
  // a tela reconecta sozinha a partir do último evento recebido.
  const inicio = Date.now();
  let ultimoSinal = Date.now();
  while (aberto && Date.now() - inicio < DURACAO_MAX_STREAM_MS) {
    await new Promise((r) => setTimeout(r, 700));
    if (!aberto) break;
    const novos = await lerEventos(id, enviados);
    const de = enviados;
    novos.forEach((evento, i) => escrever(evento, de + i + 1));
    if (novos.length === 0 && Date.now() - ultimoSinal > 15000) {
      try { res.write(': ping\n\n'); } catch { fechar(); }
      ultimoSinal = Date.now();
    } else if (novos.length > 0) {
      ultimoSinal = Date.now();
    }
  }
  fechar();
}

// --- Rotas -------------------------------------------------------------------

export async function tratarRequisicao(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (await tratarAutenticacao(req, res, url)) return;

    if (req.method === 'GET' && url.pathname === '/') {
      return servirArquivoEstatico(res, path.join(PASTA_PUBLIC, 'index.html'));
    }
    if (req.method === 'GET' && ['/estilo.css', '/app.js', '/sessao.js', '/regras-config.js'].includes(url.pathname)) {
      return servirArquivoEstatico(res, path.join(PASTA_PUBLIC, url.pathname.slice(1)));
    }
    if (req.method === 'GET' && url.pathname === '/logo.png') {
      return servirArquivoEstatico(res, ARQUIVO_LOGO);
    }

    if (req.method === 'POST' && url.pathname === '/api/plano') {
      const corpo = await lerCorpoJson(req);
      const plano = await montarPlanoDoCorpo(corpo);
      return enviarJson(res, 200, { plano: serializarPlano(plano), resumo: resumoPlano(plano) });
    }

    if (req.method === 'GET' && url.pathname === '/api/rubricas') {
      const extra = await lerValor('rubricasExtra', { avulso: [], inscricao: [] });
      return enviarJson(res, 200, {
        pagamento: rubricasDoTexto(await lerTexto(ARQ_RUBRICAS_PAGAMENTO)),
        doacao: rubricasDoTexto(await lerTexto(ARQ_RUBRICAS_DOACAO)),
        ...extra,
      });
    }

    // Lista as filiais em que este login tem acesso à Tesouraria — é
    // justamente onde aparece o link "TESOURARIA" no menu pós-login (sem
    // esse link, a pessoa não tem acesso àquela filial). Usado pra
    // preencher o seletor de filial na tela, em vez de exigir digitar o
    // nome exato.
    if (req.method === 'POST' && url.pathname === '/api/filiais/listar') {
      const corpo = await lerCorpoJson(req);
      exigirEnv();
      const credenciais = exigirCredenciais(corpo);
      return await comTrava(res, credenciais.matricula, async () => {
        const { listarFiliaisComTesouraria, lerNomeUsuarioNaTelaFuncoes } = await import('../lib/mercurioAuth.js');
        const { filiais, usuario } = await comNavegadorNaTesouraria(credenciais, null, async (page) => ({
          filiais: await listarFiliaisComTesouraria(page),
          usuario: await lerNomeUsuarioNaTelaFuncoes(page),
        }), { limiteMs: LIMITE_OPERACAO_CURTA_MS });
        return enviarJson(res, 200, { filiais, usuario });
      });
    }

    // Lista os caixas cadastrados DENTRO de uma filial já escolhida — o
    // mesmo dropdown "Caixas" que aparece na Tesouraria. Usado pra
    // preencher o seletor de caixa (padrão do lote, ou override por linha).
    if (req.method === 'POST' && url.pathname === '/api/caixas/listar') {
      const corpo = await lerCorpoJson(req);
      const filial = (corpo.filial || '').trim();
      if (!filial) throw new Error('Escolha a filial antes de listar os caixas.');
      exigirEnv();
      const credenciais = exigirCredenciais(corpo);
      return await comTrava(res, credenciais.matricula, async () => {
        const { listarCaixas, lerNomeUsuario } = await import('../lib/mercurioTesouraria.js');
        // Aproveita que já está na Tesouraria pra ler o nome de quem está
        // logado (rodapé do menu lateral) — a tela mostra junto da matrícula.
        const { caixas, usuario } = await comNavegadorNaTesouraria(credenciais, filial, async (page, info) => ({
          caixas: await listarCaixas(page),
          usuario: info.nomeUsuario || await lerNomeUsuario(page, credenciais.matricula),
        }), { limiteMs: LIMITE_OPERACAO_CURTA_MS });
        return enviarJson(res, 200, { caixas, usuario });
      });
    }

    // Loga no Mercúrio, relê o catálogo real de rubricas (Pagamento Outros
    // + Doações) e regrava os catálogos — pra quando a lista documentada
    // ficar desatualizada. Mesmo padrão de job/SSE de /api/verificar.
    if (req.method === 'POST' && url.pathname === '/api/rubricas/atualizar') {
      const corpo = await lerCorpoJson(req);
      exigirEnv();
      const credenciais = exigirCredenciais(corpo);
      return await iniciarJob(res, credenciais.matricula, (emitir) => jobAtualizarRubricas(emitir, credenciais, corpo.filial, corpo.caixa));
    }

    // Busca um aluno/membro por NOME, pra achar a matrícula na hora de
    // criar uma regra — não é um "job" com SSE (é uma busca única, não um
    // loop), só um request que demora alguns segundos porque abre o
    // navegador de verdade. Nunca lança nada.
    if (req.method === 'POST' && url.pathname === '/api/aluno/buscar') {
      const corpo = await lerCorpoJson(req);
      const nome = (corpo.nome || '').trim();
      if (!nome) throw new Error('Informe um nome pra buscar.');
      exigirEnv();
      const credenciais = exigirCredenciais(corpo);
      const nomeFilialBusca = resolverFilial(corpo.filial, process.env);
      // 1º: lista de ativos da Composição (na hora, sem abrir o Mercúrio).
      const { procurarNaComposicao } = await import('../lib/composicao.js');
      const composicao = await lerValor(`composicao:${nomeFilialBusca}`, { alunos: [] });
      const candidatos = procurarNaComposicao(composicao.alunos, nome);
      if (candidatos.length === 1) {
        const a = candidatos[0];
        return enviarJson(res, 200, { encontrado: true, matricula: a.matricula, nomeConfirmado: a.nome, valorContribuicao: a.valor, fonte: 'composicao' });
      }
      if (candidatos.length > 1) {
        return enviarJson(res, 200, {
          encontrado: false,
          motivo: 'ambiguo',
          candidatos: candidatos.map((a) => ({ nome: a.nome, matricula: a.matricula, turma: a.turma, valorContribuicao: a.valor })),
          fonte: 'composicao',
        });
      }
      return await comTrava(res, credenciais.matricula, async () => {
        const { buscarAlunoPorNomeViaFichas } = await import('../lib/mercurioTesouraria.js');
        const resultado = await comNavegadorNaTesouraria(credenciais, nomeFilialBusca, (page) => buscarAlunoPorNomeViaFichas(page, nome), { limiteMs: LIMITE_OPERACAO_CURTA_MS });
        return enviarJson(res, 200, resultado);
      });
    }

    // Busca EM LOTE — loga uma vez só e procura vários nomes em sequência
    // (usado pelo botão "Buscar matrículas em lote", que junta todas as
    // transações de crédito SEM REGRA de uma vez, em vez de repetir login
    // a cada clique individual de "Buscar").
    if (req.method === 'POST' && url.pathname === '/api/alunos/buscar-lote') {
      const corpo = await lerCorpoJson(req);
      const lista = Array.isArray(corpo.lista) ? corpo.lista : [];
      if (lista.length === 0) throw new Error('Nenhum nome pra buscar.');
      exigirEnv();
      const credenciais = exigirCredenciais(corpo);
      return await iniciarJob(res, credenciais.matricula, (emitir, prazo) => jobBuscaAlunosLote(emitir, prazo, lista, credenciais, corpo.filial));
    }

    // Tela de configuração de regras — lista TODAS (inclusive desativadas),
    // com o índice real de cada uma, sem precisar de extrato nenhum.
    // Composição das contribuições da filial (lida no Mercúrio junto com
    // as rubricas, em segundo plano) — ativos com matrícula, nome e valor.
    if (req.method === 'GET' && url.pathname === '/api/composicao') {
      const filial = (url.searchParams.get('filial') || '').trim();
      if (!filial) throw new Error('Informe a filial.');
      return enviarJson(res, 200, await lerValor(`composicao:${filial}`, { lidaEm: null, alunos: [] }));
    }

    if (req.method === 'GET' && url.pathname === '/api/regras') {
      const json = await lerJson(ARQ_REGRAS, { regras: [] });
      const regras = (json.regras || []).map((r, indice) => ({ ...r, indice, ativa: r.ativa !== false }));
      return enviarJson(res, 200, { regras });
    }

    // Baixa as regras como arquivo .json (cópia de segurança, ou levar pra
    // pasta portátil — é o mesmo formato do regras.json).
    if (req.method === 'GET' && url.pathname === '/api/regras/exportar') {
      const json = await lerJson(ARQ_REGRAS, { regras: [] });
      const corpo = JSON.stringify({ regras: json.regras || [] }, null, 2) + '\n';
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="regras-tesouraria-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      });
      return res.end(corpo);
    }

    // Carrega regras de um .json exportado — "substituir" troca todas,
    // "acrescentar" soma às atuais. Valida tudo antes de gravar.
    if (req.method === 'POST' && url.pathname === '/api/regras/importar') {
      const corpo = await lerCorpoJson(req);
      const lista = Array.isArray(corpo.regras) ? corpo.regras : (corpo.json && corpo.json.regras);
      const json = await lerJson(ARQ_REGRAS, { regras: [] });
      const { regras, importadas } = importarRegras(json, lista, corpo.modo);
      await gravarJson(ARQ_REGRAS, json);
      return enviarJson(res, 200, { ok: true, totalRegras: regras.length, importadas });
    }

    // Cria uma regra nova (o formulário "Criar regra" da etapa 2, pra
    // transações SEM REGRA) — grava de verdade (regras.json localmente, ou
    // Redis online), o MESMO lugar que o resto do app já lê. Quem chamou é
    // responsável por gerar o plano de novo (POST /api/plano) pra ver o
    // efeito imediatamente.
    if (req.method === 'POST' && url.pathname === '/api/regras') {
      const corpo = await lerCorpoJson(req);
      const json = await lerJson(ARQ_REGRAS, { regras: [] });
      const { regras, regraCriada } = adicionarRegra(json, corpo.regra || {});
      await gravarJson(ARQ_REGRAS, json);
      return enviarJson(res, 200, { ok: true, totalRegras: regras.length, regraCriada });
    }

    // Edita uma regra já existente (botão "Editar" logo abaixo do "regra:
    // ..." de um lançamento já casado) — grava no lugar exato dela, via o
    // índice devolvido em regraIndice pelo /api/plano.
    if (req.method === 'POST' && url.pathname === '/api/regras/editar') {
      const corpo = await lerCorpoJson(req);
      const indice = Number(corpo.indice);
      if (!Number.isInteger(indice) || indice < 0) throw new Error('Índice de regra inválido.');
      const json = await lerJson(ARQ_REGRAS, { regras: [] });
      const { regras, regraEditada } = editarRegra(json, indice, corpo.regra || {});
      await gravarJson(ARQ_REGRAS, json);
      return enviarJson(res, 200, { ok: true, totalRegras: regras.length, regraEditada });
    }

    // Exclui uma regra já existente (botão "Excluir regra" dentro do
    // "Editar regra") — a transação volta a aparecer como SEM REGRA depois
    // do plano ser regenerado, liberando o lançamento manual de novo.
    if (req.method === 'POST' && url.pathname === '/api/regras/excluir') {
      const corpo = await lerCorpoJson(req);
      const indice = Number(corpo.indice);
      if (!Number.isInteger(indice) || indice < 0) throw new Error('Índice de regra inválido.');
      const json = await lerJson(ARQ_REGRAS, { regras: [] });
      const { regras, regraRemovida } = removerRegra(json, indice);
      await gravarJson(ARQ_REGRAS, json);
      return enviarJson(res, 200, { ok: true, totalRegras: regras.length, regraRemovida });
    }

    if (req.method === 'POST' && url.pathname === '/api/verificar') {
      const corpo = await lerCorpoJson(req);
      const plano = await montarPlanoDoCorpo(corpo);
      exigirEnv();
      const credenciais = exigirCredenciais(corpo);
      return await iniciarJob(res, credenciais.matricula, (emitir, prazo) => jobVerificacao(emitir, prazo, plano, credenciais, corpo.filial, corpo.caixaPadrao));
    }

    if (req.method === 'POST' && url.pathname === '/api/lancar') {
      const corpo = await lerCorpoJson(req);
      const plano = await montarPlanoDoCorpo(corpo);
      exigirEnv();
      const credenciais = exigirCredenciais(corpo);
      // Opcional — "Rodar de novo só os que falharam": índices (posições
      // em `plano`, estáveis pro mesmo extrato) a processar desta vez. O
      // plano em si já foi remontado do zero acima (montarPlanoDoCorpo),
      // então já reflete qualquer regra criada/editada desde a rodada
      // anterior — sem indicesParaLancar, processa tudo, como sempre.
      const indicesParaLancar = Array.isArray(corpo.indicesParaLancar) ? corpo.indicesParaLancar : null;
      return await iniciarJob(res, credenciais.matricula, (emitir, prazo) => jobLancamento(emitir, prazo, plano, credenciais, corpo.filial, corpo.caixaPadrao, indicesParaLancar));
    }

    // Stream é compartilhado por todos os jobs — cada um só cria um jobId
    // e o cliente acompanha do mesmo jeito.
    const matchStream = url.pathname.match(/^\/api\/job\/([a-f0-9-]+)\/stream$/);
    if (req.method === 'GET' && matchStream) {
      return await transmitirJob(req, res, matchStream[1], url);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  } catch (e) {
    if (res.headersSent) {
      console.error('Erro depois de a resposta já ter começado:', e);
      try { res.end(); } catch { /* conexão já caiu */ }
      return;
    }
    enviarJson(res, 400, { erro: e.message });
  }
}
