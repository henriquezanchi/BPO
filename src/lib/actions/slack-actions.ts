"use server";

import { comAcessoVoluntario } from "@/lib/acesso-voluntario";
import { requireTeacherOfClass } from "@/lib/auth";
import { db } from "@/lib/db";
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
  await requireTeacherOfClass(classGroupId);
  const grupo = await db.classGroup.findUniqueOrThrow({ where: { id: classGroupId }, include: { school: { select: { mercurioUnidade: true } } } });
  const token = tokenSlackDaFilial(grupo.school.mercurioUnidade);
  if (!token) throw new Error("O Slack ainda não está conectado nesta filial.");
  return { grupo, token };
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
    const { token } = await contexto(classGroupId);
    const channelId = idDoCanal(linkOuId);
    if (!channelId) return { ok: false as const, error: "Não reconheci esse link. No Slack, clique com o botão direito no canal → Copiar link." };
    await verificarCanal(token, channelId);
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
