"use server";

import { comAcessoVoluntario } from "@/lib/acesso-voluntario";
import { requireTeacherOfClass } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeAdministrar } from "@/lib/recursos-filial";
import {
  convidarParaCanal,
  criarCanalPrivado,
  idDoCanal,
  identificarWorkspace,
  mensagemErroSlack,
  tokenSlackDaFilial,
  usuarioPorEmail,
  verificarCanal,
} from "@/lib/slack";
import { revalidatePath } from "next/cache";

/**
 * Ações do responsável pelo grupo/turma (role "professor" — chefe de
 * brigada, instrutor) sobre o canal do Slack da filial. Toda ação reconfere
 * no servidor que quem chama é responsável por AQUELE grupo; o token do bot
 * nunca sai do servidor.
 */
async function contexto(classGroupId: string) {
  const member = await requireTeacherOfClass(classGroupId);
  const grupo = await db.classGroup.findUniqueOrThrow({ where: { id: classGroupId }, include: { school: { select: { mercurioUnidade: true } } } });
  const token = tokenSlackDaFilial(grupo.school.mercurioUnidade);
  if (!token) throw new Error("O Slack ainda não está conectado nesta filial.");
  return { member, grupo, token };
}

/** Convida pro canal todo integrante/responsável do grupo que tem conta no Slack da filial (achado pelo e-mail do cadastro). */
async function convidarIntegrantes(classGroupId: string, token: string, channelId: string) {
  const grupo = await db.classGroup.findUniqueOrThrow({ where: { id: classGroupId }, select: { tipo: true } });
  const todos = await db.classMembership.findMany({ where: { classGroupId }, include: { member: { select: { email: true } } } });
  // Grupo de voluntários: só convida quem já tem o acesso liberado.
  const liberados = grupo.tipo === "turma" ? null : await comAcessoVoluntario(todos.map((v) => v.memberId));
  const vinculos = liberados ? todos.filter((v) => liberados.has(v.memberId)) : todos;
  const emails = [...new Set(vinculos.map((v) => v.member.email?.trim().toLowerCase()).filter((e): e is string => !!e))];
  const ids: string[] = [];
  let semConta = 0;
  for (const email of emails) {
    const id = await usuarioPorEmail(token, email);
    if (id) ids.push(id);
    else semConta++;
  }
  await convidarParaCanal(token, channelId, ids);
  return { convidados: ids.length, semConta: semConta + (vinculos.length - emails.length) };
}

export async function criarCanalSlack(classGroupId: string) {
  try {
    const { grupo, token } = await contexto(classGroupId);
    if (grupo.slackChannelId) return { ok: false as const, error: "Este grupo já tem um canal vinculado." };
    const channelId = await criarCanalPrivado(token, grupo.name);
    const teamId = await identificarWorkspace(token);
    await db.classGroup.update({ where: { id: classGroupId }, data: { slackChannelId: channelId, slackTeamId: teamId } });
    const r = await convidarIntegrantes(classGroupId, token, channelId);
    revalidatePath(`/professor/turma/${classGroupId}`);
    return { ok: true as const, ...r };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error && !e.message.startsWith("Slack:") ? e.message : mensagemErroSlack(e) };
  }
}

export async function vincularCanalSlack(classGroupId: string, linkOuId: string) {
  try {
    const { member, grupo, token } = await contexto(classGroupId);
    const channelId = idDoCanal(linkOuId);
    if (!channelId) return { ok: false as const, error: "Não reconheci esse link. No Slack, clique com o botão direito no canal → Copiar link." };
    // 25/11/2026: um canal serve a um grupo só — senão o professor de uma turma convidaria a sua turma pro canal de outra.
    if (await db.classGroup.count({ where: { slackChannelId: channelId, id: { not: classGroupId } } })) return { ok: false as const, error: "Esse canal já está vinculado a outro grupo." };
    const canal = await verificarCanal(token, channelId);
    // 25/11/2026: o Portal não guarda quais canais privados ele mesmo criou, então canal privado pré-existente
    // (ex.: o da direção) só com quem administra a filial; o professor vincula canais públicos ou cria um novo.
    if (canal.is_private && !(await podeAdministrar(member, grupo.schoolId))) return { ok: false as const, error: "Canal privado só pode ser vinculado por quem administra a filial. Use \"Criar canal\" ou vincule um canal público." };
    const teamId = await identificarWorkspace(token);
    await db.classGroup.update({ where: { id: classGroupId }, data: { slackChannelId: channelId, slackTeamId: teamId } });
    const r = await convidarIntegrantes(classGroupId, token, channelId);
    revalidatePath(`/professor/turma/${classGroupId}`);
    return { ok: true as const, ...r };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error && !e.message.startsWith("Slack:") ? e.message : mensagemErroSlack(e) };
  }
}

export async function sincronizarIntegrantesSlack(classGroupId: string) {
  try {
    const { grupo, token } = await contexto(classGroupId);
    if (!grupo.slackChannelId) return { ok: false as const, error: "Este grupo ainda não tem canal no Slack." };
    return { ok: true as const, ...(await convidarIntegrantes(classGroupId, token, grupo.slackChannelId)) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error && !e.message.startsWith("Slack:") ? e.message : mensagemErroSlack(e) };
  }
}

export async function desvincularCanalSlack(classGroupId: string) {
  await requireTeacherOfClass(classGroupId);
  await db.classGroup.update({ where: { id: classGroupId }, data: { slackChannelId: null, slackTeamId: null } });
  revalidatePath(`/professor/turma/${classGroupId}`);
  return { ok: true as const };
}
