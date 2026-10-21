"use server";

import { comAcessoVoluntario } from "@/lib/acesso-voluntario";
import { requireTeacherOfClass } from "@/lib/auth";
import { db } from "@/lib/db";
import { enviarPush } from "@/lib/push";
import { postarNoCanal, tokenSlackDaFilial } from "@/lib/slack";
import { PROVAS_CONJUNTAS, temasValidos } from "@/lib/temas-curriculo";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { revalidatePath } from "next/cache";
import type { ActivityType } from "@prisma/client";

export interface CreateActivityInput {
  classGroupId: string;
  type: ActivityType;
  title: string;
  studyItems?: string;
  /** Matéria em curso na turma (TurmaMateria.materiaSigla) e temas do catálogo — 2026-10-21. */
  materiaSigla?: string;
  temas?: string[];
  description?: string;
  dueDate: Date;
  /** Também posta no canal do Slack vinculado ao grupo (se houver). */
  publicarNoSlack?: boolean;
}

/**
 * Professor cadastra uma atividade (prova, trabalho, leitura...) para a
 * turma. Todos os alunos matriculados na turma passam a ver a atividade em
 * "Agenda & Eventos" no Portal do Aluno automaticamente — não é uma seção
 * nova, é a mesma agenda que já lista os eventos da escola.
 *
 * O aviso por WhatsApp é disparado na hora (quando o provedor estiver
 * conectado) e, desde 2026-10-21, também por notificação push (PWA) para
 * quem ativou as notificações no celular.
 */
export async function createActivity(input: CreateActivityInput) {
  const professor = await requireTeacherOfClass(input.classGroupId);

  // Só aceita matéria que a turma está cursando e temas que existem no catálogo dela.
  // Prova conjunta (ex.: conclusão do N1): vale se a turma cursa alguma das matérias dela.
  const conjunta = input.materiaSigla ? PROVAS_CONJUNTAS[input.materiaSigla] : undefined;
  const materia = conjunta
    ? (await db.turmaMateria.count({ where: { classGroupId: input.classGroupId, materiaSigla: { in: conjunta.materias.map((m) => m.sigla) } } }))
      ? { materiaSigla: input.materiaSigla!, materiaNome: conjunta.nome }
      : null
    : input.materiaSigla
      ? await db.turmaMateria.findUnique({ where: { classGroupId_materiaSigla: { classGroupId: input.classGroupId, materiaSigla: input.materiaSigla } } })
      : null;
  if (input.materiaSigla && !materia) throw new Error("Essa matéria não está em curso nesta turma.");
  const temas = materia ? temasValidos(materia.materiaSigla, input.temas ?? []) : [];

  const activity = await db.activity.create({
    data: {
      classGroupId: input.classGroupId,
      createdById: professor.id,
      type: input.type,
      title: input.title,
      materiaSigla: materia?.materiaSigla ?? null,
      materiaNome: materia?.materiaNome ?? null,
      temas,
      studyItems: input.studyItems,
      description: input.description,
      dueDate: input.dueDate,
    },
  });

  const grupoTipo = (await db.classGroup.findUniqueOrThrow({ where: { id: input.classGroupId }, select: { tipo: true } })).tipo;
  const rosterTodo = await db.classMembership.findMany({
    where: { classGroupId: input.classGroupId, role: "aluno" },
    include: { member: true },
  });
  // Grupo de voluntários: só avisa quem já tem o acesso liberado.
  const liberados = grupoTipo === "turma" ? null : await comAcessoVoluntario(rosterTodo.map((r) => r.memberId));
  const roster = liberados ? rosterTodo.filter((r) => liberados.has(r.memberId)) : rosterTodo;

  await db.activityNotification.createMany({
    data: roster.map((r) => ({
      activityId: activity.id,
      memberId: r.memberId,
      channel: "whatsapp" as const,
    })),
  });

  const grupo = await db.classGroup.findUniqueOrThrow({ where: { id: input.classGroupId }, include: { school: { select: { mercurioUnidade: true } } } });
  const dueDateLabel = input.dueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const origem = grupo.tipo === "turma" ? "da turma" : `— ${grupo.name}`;
  const corpo = `${input.type === "aviso" ? "Novo aviso" : "Nova atividade"} ${origem}: *${input.title}* (${dueDateLabel}).${
    materia ? `\nMatéria: ${materia.materiaNome}` : ""
  }${temas.length ? `\nTemas: ${temas.join("; ")}` : ""}${input.studyItems ? `\nConteúdo: ${input.studyItems}` : ""}${input.description ? `\n${input.description}` : ""}`;
  const message = `${corpo}\nConfira em Agenda & Eventos no Portal do Aluno.`;

  // Slack é complemento: uma falha lá não desfaz a publicação no Portal.
  let slack: "enviado" | "falhou" | null = null;
  const token = tokenSlackDaFilial(grupo.school.mercurioUnidade);
  if (input.publicarNoSlack && grupo.slackChannelId && token) {
    slack = await postarNoCanal(token, grupo.slackChannelId, corpo)
      .then(() => "enviado" as const)
      .catch((e) => {
        console.error("Falha ao postar no Slack:", e);
        return "falhou" as const;
      });
  }

  const results = await Promise.all(
    roster.map(async (r) => {
      const result = await sendWhatsAppMessage(r.member.whatsapp, message);
      await db.activityNotification.updateMany({
        where: { activityId: activity.id, memberId: r.memberId },
        data: result.ok
          ? { status: "enviado", sentAt: new Date() }
          : { status: "falhou" },
      });
      return result.ok;
    }),
  );

  const push = await enviarPush(
    roster.map((r) => r.memberId),
    {
      titulo: `${input.type === "aviso" ? "Novo aviso" : "Nova atividade"} ${grupo.tipo === "turma" ? "da turma" : `· ${grupo.name}`}`,
      corpo: `${input.title}${materia ? ` · ${materia.materiaNome}` : ""} (${dueDateLabel})`,
      url: "/portal",
      etiqueta: `atividade-${activity.id}`,
    },
  ).catch((e) => {
    console.error("Falha ao enviar push da atividade:", e);
    return { pessoas: 0, aparelhos: 0 };
  });

  revalidatePath("/portal");
  revalidatePath(`/professor/turma/${input.classGroupId}`);

  return { id: activity.id, slack, push: { pessoas: push.pessoas, total: roster.length }, whatsapp: { sent: results.filter(Boolean).length, total: roster.length, failed: results.filter(ok=>!ok).length } };
}


/** Edição/exclusão sempre conferem o responsável pelo grupo real do registro. */
export async function manageActivity(id: string, input: Omit<CreateActivityInput, "classGroupId" | "publicarNoSlack"> | null) {
  try {
    const activity = await db.activity.findUniqueOrThrow({ where: { id }, select: { classGroupId: true, materiaSigla: true } });
    await requireTeacherOfClass(activity.classGroupId);
    if (input) {
      const group = await db.classGroup.findUniqueOrThrow({ where: { id: activity.classGroupId }, select: { tipo: true } });
      const types = group.tipo === "turma" ? ["prova", "trabalho", "leitura", "atividade_turma", "aviso"] : ["atividade_turma", "aviso"];
      if (!types.includes(input.type) || !input.title.trim() || input.title.length > 160 || (input.description?.length ?? 0) > 5000 || (input.studyItems?.length ?? 0) > 5000 || !(input.dueDate instanceof Date) || !Number.isFinite(input.dueDate.getTime())) {
        return { ok: false, error: "Confira o título, a data e o conteúdo da publicação." };
      }
      await db.activity.update({ where: { id }, data: { type: input.type, title: input.title.trim(), description: input.description?.trim() || null, studyItems: input.studyItems?.trim() || null, dueDate: input.dueDate, ...(input.temas ? { temas: temasValidos(activity.materiaSigla, input.temas) } : {}) } });
    } else {
      await db.$transaction(async tx => {
        await tx.activityNotification.deleteMany({ where: { activityId: id } });
        await tx.activity.delete({ where: { id } });
      });
    }
    revalidatePath(`/professor/turma/${activity.classGroupId}`);
    revalidatePath("/portal");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível concluir. Atualize a página e confira seu acesso ao grupo." };
  }
}
