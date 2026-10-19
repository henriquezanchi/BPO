// Onde a Tesouraria guarda o que muda durante o uso — regras.json, os
// catálogos de rubricas (.md), o catálogo de Avulsos/Inscrições e o
// andamento dos jobs (eventos que a tela acompanha ao vivo).
//
// Dentro do Portal (2026-10-19): mesma interface do armazenamento original,
// mas no banco do Portal (Prisma) em vez do Upstash Redis. Regras, catálogos
// e valores ficam separados POR FILIAL do Portal (escopo vindo da requisição
// — ver pages/api/tesouraria); jobs e travas são globais (chaves já únicas).
// Na primeira leitura de um arquivo, o conteúdo vem do pacote (dados/) — o
// mesmo "seed" do modo Redis original.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { db } from '@/lib/db';

const PASTA_DADOS = path.join(process.cwd(), 'src', 'tesouraria', 'dados');
const VALIDADE_JOB_MS = 24 * 60 * 60 * 1000;

// Sempre "modo compartilhado" (equivalente ao Redis): várias instâncias da
// Vercel, nada em memória do processo. O /stream consulta lerEventos().
export const USANDO_REDIS = true;

const contexto = new AsyncLocalStorage();

/** Roda `fn` com o escopo (id da filial no Portal) de quem fez a requisição. */
export function comEscopo(escopo, fn) {
  return contexto.run({ escopo }, fn);
}

function escopo() {
  const atual = contexto.getStore();
  if (!atual?.escopo) throw new Error('Tesouraria sem filial definida na requisição.');
  return atual.escopo;
}

// --- Textos (regras.json, RUBRICAS_*.md) -----------------------------------

export async function lerTexto(nomeArquivo) {
  const e = escopo();
  const salvo = await db.tesourariaArquivo.findUnique({ where: { escopo_nome: { escopo: e, nome: nomeArquivo } } });
  if (salvo) return salvo.conteudo;
  const caminho = path.join(PASTA_DADOS, nomeArquivo);
  if (!fs.existsSync(caminho)) return null;
  const doPacote = fs.readFileSync(caminho, 'utf-8');
  await db.tesourariaArquivo.upsert({
    where: { escopo_nome: { escopo: e, nome: nomeArquivo } },
    update: {},
    create: { escopo: e, nome: nomeArquivo, conteudo: doPacote },
  });
  return doPacote;
}

export async function gravarTexto(nomeArquivo, conteudo) {
  const e = escopo();
  await db.tesourariaArquivo.upsert({
    where: { escopo_nome: { escopo: e, nome: nomeArquivo } },
    update: { conteudo, atualizadoEm: new Date() },
    create: { escopo: e, nome: nomeArquivo, conteudo },
  });
}

export async function lerJson(nomeArquivo, padrao) {
  const texto = await lerTexto(nomeArquivo);
  return texto === null ? padrao : JSON.parse(texto);
}

export async function gravarJson(nomeArquivo, obj) {
  await gravarTexto(nomeArquivo, JSON.stringify(obj, null, 2) + '\n');
}

// --- Valores pequenos sem arquivo (catálogo de Avulsos/Inscrições, falhas de login) ---

export async function lerValor(chave, padrao) {
  const e = contexto.getStore()?.escopo ?? 'global';
  const salvo = await db.tesourariaValor.findUnique({ where: { escopo_chave: { escopo: e, chave } } });
  return salvo ? salvo.valor : padrao;
}

export async function gravarValor(chave, valor) {
  const e = contexto.getStore()?.escopo ?? 'global';
  await db.tesourariaValor.upsert({
    where: { escopo_chave: { escopo: e, chave } },
    update: { valor, atualizadoEm: new Date() },
    create: { escopo: e, chave, valor },
  });
}

// --- Jobs (eventos acompanhados pela tela via SSE) --------------------------

export function novoIdJob() {
  return crypto.randomUUID();
}

export async function registrarJob(id) {
  await db.tesourariaJob.create({ data: { id } });
  // Limpeza oportunista: jobs com mais de 1 dia já não interessam à tela.
  const limite = new Date(Date.now() - VALIDADE_JOB_MS);
  await db.tesourariaJobEvento.deleteMany({ where: { criadoEm: { lt: limite } } }).catch(() => {});
  await db.tesourariaJob.deleteMany({ where: { criadoEm: { lt: limite } } }).catch(() => {});
}

export async function jobExiste(id) {
  return (await db.tesourariaJob.count({ where: { id } })) > 0;
}

export async function adicionarEvento(id, evento) {
  // Um job só tem um escritor (o executor), então "próxima posição" é seguro.
  const ultimo = await db.tesourariaJobEvento.findFirst({ where: { jobId: id }, orderBy: { posicao: 'desc' }, select: { posicao: true } });
  await db.tesourariaJobEvento.create({ data: { jobId: id, posicao: (ultimo?.posicao ?? -1) + 1, evento } });
}

// Eventos a partir da posição `desde` (0 = todos).
export async function lerEventos(id, desde = 0) {
  const linhas = await db.tesourariaJobEvento.findMany({ where: { jobId: id, posicao: { gte: desde } }, orderBy: { posicao: 'asc' } });
  return linhas.map((l) => l.evento);
}

// Só existia no modo local; aqui o /stream consulta lerEventos() em intervalos.
export function ouvirEventosLocais() {
  return null;
}

// --- Trava de "uma operação por vez" POR MATRÍCULA -------------------------
// Expira sozinha depois de `validadeS`, pra nunca ficar presa se a função
// for encerrada no meio.

export async function tentarTravar(chave, dono, validadeS) {
  const agora = new Date();
  await db.tesourariaTrava.deleteMany({ where: { chave, expiraEm: { lt: agora } } });
  try {
    await db.tesourariaTrava.create({ data: { chave, dono, expiraEm: new Date(agora.getTime() + validadeS * 1000) } });
    return true;
  } catch {
    return false; // já travada por outro dono
  }
}

export async function liberarTrava(chave, dono) {
  await db.tesourariaTrava.deleteMany({ where: { chave, dono } });
}
