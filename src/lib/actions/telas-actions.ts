"use server";

import { requireArea } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizarCodigo } from "@/lib/telas-conexao";
import { novoTokenTela } from "@/lib/telas-eventos";
import { FRASES_PADRAO } from "@/lib/telas-frases";
import { TIPOS_CARTAO, validarConteudosTela, validarOrientacaoTela, validarPublicosTela, type TipoCartao } from "@/lib/telas-publicos";
import { revalidatePath } from "next/cache";

/** Telas de TV da filial (pedido do usuário 2026-10-24): quem cuida dos Eventos cria e ajusta. */
type Resultado = { ok: true } | { ok: false; error: string };

export type DadosTela = { nome: string; publicos: string[]; conteudos: string[]; orientacao: string };

async function executar(acao: () => Promise<unknown>, falha: string): Promise<Resultado> {
  try {
    await acao();
    revalidatePath("/voluntario/eventos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error && !e.message.includes("prisma") ? e.message : falha };
  }
}

function validarNome(nome: string) {
  const n = nome.trim().replace(/\s+/g, " ");
  if (!n) throw Error("Dê um nome à tela (ex.: TV da recepção).");
  return n.slice(0, 60);
}

function validarTela(d: DadosTela) {
  const publicos = validarPublicosTela(d.publicos);
  return { nome: validarNome(d.nome), publicos, conteudos: validarConteudosTela(d.conteudos, publicos), orientacao: validarOrientacaoTela(d.orientacao) };
}

function garantir(count: number) {
  if (!count) throw Error("Tela não encontrada nesta filial.");
}

export async function criarTela(schoolId: string, dados: DadosTela) {
  return executar(async () => {
    const actor = await requireArea(schoolId, "eventos");
    await db.telaEventos.create({ data: { schoolId, ...validarTela(dados), token: novoTokenTela(), criadoPor: actor.id } });
  }, "Não foi possível criar a tela.");
}

export async function atualizarTela(schoolId: string, id: string, dados: DadosTela) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.telaEventos.updateMany({ where: { id, schoolId }, data: validarTela(dados) })).count);
  }, "Não foi possível salvar a tela.");
}

/** Troca o link: a TV com o link antigo para de mostrar os eventos. */
export async function trocarLinkTela(schoolId: string, id: string) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.telaEventos.updateMany({ where: { id, schoolId }, data: { token: novoTokenTela() } })).count);
  }, "Não foi possível trocar o link.");
}

export async function excluirTela(schoolId: string, id: string) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.telaEventos.deleteMany({ where: { id, schoolId } })).count);
  }, "Não foi possível excluir a tela.");
}

/** Liga a TV que mostra o código (em /tv) a esta tela. */
export async function conectarTv(schoolId: string, telaId: string, codigo: string) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    const c = normalizarCodigo(codigo);
    if (!c) throw Error("O código tem 6 números, como aparece na TV.");
    if (!(await db.telaEventos.count({ where: { id: telaId, schoolId } }))) throw Error("Tela não encontrada nesta filial.");
    const r = await db.tvConexao.updateMany({ where: { codigo: c, telaId: null, expiraEm: { gt: new Date() } }, data: { telaId, conectadoEm: new Date() } });
    if (!r.count) throw Error("Código não encontrado ou vencido. Confira o número na TV (ele muda a cada 15 minutos).");
  }, "Não foi possível conectar a TV.");
}

// ---------- Cartões da filial (avisos, Círculo de Amigos, Instagram, Acrópole Play) ----------

export type DadosCartao = { tipo: string; titulo: string; texto: string; link: string; ate: string };

function validarCartao(d: DadosCartao) {
  if (!Object.hasOwn(TIPOS_CARTAO, d.tipo)) throw Error("Tipo de cartão inválido.");
  const titulo = d.titulo.trim().replace(/\s+/g, " ").slice(0, 90);
  if (!titulo) throw Error("Escreva o título do cartão.");
  const texto = d.texto.trim().slice(0, 220) || null;
  let link: string | null = d.link.trim() || null;
  if (link) {
    if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
    try {
      const u = new URL(link);
      if (u.protocol !== "https:") throw 0;
      link = u.toString();
    } catch {
      throw Error("O link precisa ser um endereço https:// válido.");
    }
  }
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(d.ate) ? new Date(`${d.ate}T23:59:59-03:00`) : null;
  return { tipo: d.tipo as TipoCartao, titulo, texto, link, ate };
}

export async function criarCartao(schoolId: string, dados: DadosCartao) {
  return executar(async () => {
    const actor = await requireArea(schoolId, "eventos");
    await db.telaCartao.create({ data: { schoolId, ...validarCartao(dados), criadoPor: actor.id } });
  }, "Não foi possível criar o cartão.");
}

export async function atualizarCartao(schoolId: string, id: string, dados: DadosCartao) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.telaCartao.updateMany({ where: { id, schoolId }, data: validarCartao(dados) })).count);
  }, "Não foi possível salvar o cartão.");
}

export async function excluirCartao(schoolId: string, id: string) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.telaCartao.deleteMany({ where: { id, schoolId } })).count);
  }, "Não foi possível excluir o cartão.");
}

// ---------- Frases da semana da filial ----------

export type DadosFrase = { texto: string; autor: string; obra: string; ativa: boolean };

function validarFrase(d: DadosFrase) {
  const texto = d.texto.trim().replace(/\s+/g, " ").replace(/^["“”']+|["“”']+$/g, "");
  if (!texto) throw Error("Escreva a frase.");
  if (texto.length > 220) throw Error("A frase pode ter até 220 letras, para caber na TV.");
  const autor = d.autor.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!autor) throw Error("Diga quem é o autor da frase.");
  return { texto, autor, obra: d.obra.trim().replace(/\s+/g, " ").slice(0, 90) || null, ativa: d.ativa };
}

export async function criarFrase(schoolId: string, dados: DadosFrase) {
  return executar(async () => {
    const actor = await requireArea(schoolId, "eventos");
    await db.fraseTela.create({ data: { schoolId, ...validarFrase(dados), criadoPor: actor.id } });
  }, "Não foi possível salvar a frase.");
}

export async function atualizarFrase(schoolId: string, id: string, dados: DadosFrase) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.fraseTela.updateMany({ where: { id, schoolId }, data: validarFrase(dados) })).count);
  }, "Não foi possível salvar a frase.");
}

export async function excluirFrase(schoolId: string, id: string) {
  return executar(async () => {
    await requireArea(schoolId, "eventos");
    garantir((await db.fraseTela.deleteMany({ where: { id, schoolId } })).count);
  }, "Não foi possível apagar a frase.");
}

/** Traz para a filial as frases da lista padrão que ela ainda não tem (para editar ou desligar). */
export async function importarFrasesPadrao(schoolId: string) {
  return executar(async () => {
    const actor = await requireArea(schoolId, "eventos");
    const ja = new Set((await db.fraseTela.findMany({ where: { schoolId }, select: { texto: true } })).map((f) => f.texto));
    const novas = FRASES_PADRAO.filter((f) => !ja.has(f.texto));
    if (novas.length) await db.fraseTela.createMany({ data: novas.map((f) => ({ schoolId, ...f, criadoPor: actor.id })) });
  }, "Não foi possível importar as frases.");
}
