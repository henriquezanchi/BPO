"use server";

import { DURACOES, ehInstrutor, fusoDaEscola, horariosDoInstrutor, MODALIDADES, podeMarcarCom } from "@/lib/atendimentos";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { avisarSemEsperar } from "@/lib/push";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

/** Ações dos atendimentos individuais (pedido do usuário 2026-10-25). Todas devolvem { ok, error? }. */

type Resultado = { ok: true } | { ok: false; error: string };
const falha = (error: string): Resultado => ({ ok: false, error });

function quando(d: Date, fuso: string) {
  return d.toLocaleString("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const primeiroNome = (n: string) => n.split(" ").slice(0, 2).join(" ");
const minutos = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

function atualizar() {
  revalidatePath("/professor/atendimentos");
  revalidatePath("/atendimentos");
  revalidatePath("/portal");
}

async function instrutorLogado() {
  const m = await getAuthenticatedMember();
  if (!m) return null;
  return (await ehInstrutor(m)) ? m : null;
}

// ───────────────────────── Instrutor: faixas de horário ─────────────────────────

export async function salvarJanela(f: FormData): Promise<Resultado> {
  const m = await instrutorLogado();
  if (!m) return falha("Só instrutores abrem horários de atendimento.");
  const tipo = String(f.get("tipo") ?? "semanal");
  const diaSemana = Number(f.get("diaSemana"));
  const data = String(f.get("data") ?? "");
  const inicio = minutos(String(f.get("inicio") ?? ""));
  const fim = minutos(String(f.get("fim") ?? ""));
  const duracao = Number(f.get("duracao"));
  const modalidade = String(f.get("modalidade") ?? "presencial");
  const local = String(f.get("local") ?? "").trim().slice(0, 120) || null;
  const linkOnline = String(f.get("linkOnline") ?? "").trim().slice(0, 300) || null;

  if (tipo === "semanal" && !(diaSemana >= 0 && diaSemana <= 6)) return falha("Escolha o dia da semana.");
  if (tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return falha("Escolha a data.");
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return falha("O fim precisa ser depois do início.");
  if (fim - inicio > 8 * 60) return falha("Use faixas de até 8 horas.");
  if (!DURACOES.includes(duracao as (typeof DURACOES)[number])) return falha("Escolha a duração de cada conversa.");
  if (fim - inicio < duracao) return falha("A faixa é menor que uma conversa.");
  if (!(modalidade in MODALIDADES)) return falha("Escolha presencial ou online.");
  if (linkOnline && !/^https:\/\//i.test(linkOnline)) return falha("O link da chamada precisa começar com https://");
  const fuso = fusoDaEscola(m.school.uf);
  if (tipo === "data" && data < new Date().toLocaleDateString("en-CA", { timeZone: fuso })) return falha("Escolha uma data de hoje em diante.");

  // Faixas do mesmo instrutor não podem se sobrepor no mesmo dia.
  const outras = await db.atendimentoJanela.findMany({ where: { instrutorId: m.id, ativa: true } });
  const choca = outras.some(
    (j) =>
      (tipo === "data" ? j.data === data || (!j.data && j.diaSemana === new Date(`${data}T12:00:00Z`).getUTCDay()) : j.diaSemana === diaSemana || (!!j.data && new Date(`${j.data}T12:00:00Z`).getUTCDay() === diaSemana)) &&
      inicio < j.fimMinuto &&
      j.inicioMinuto < fim,
  );
  if (choca) return falha("Já existe uma faixa sua nesse dia e horário.");

  await db.atendimentoJanela.create({
    data: {
      schoolId: m.schoolId,
      instrutorId: m.id,
      diaSemana: tipo === "semanal" ? diaSemana : null,
      data: tipo === "data" ? data : null,
      inicioMinuto: inicio,
      fimMinuto: fim,
      duracaoMinutos: duracao,
      modalidade,
      local,
      linkOnline,
    },
  });
  atualizar();
  return { ok: true };
}

/** Remove a faixa; conversas já marcadas continuam valendo. */
export async function excluirJanela(id: string): Promise<Resultado> {
  const m = await instrutorLogado();
  if (!m) return falha("Sem permissão.");
  const r = await db.atendimentoJanela.updateMany({ where: { id, instrutorId: m.id }, data: { ativa: false } });
  if (!r.count) return falha("Faixa não encontrada.");
  atualizar();
  return { ok: true };
}

/** Fecha ou reabre um dia inteiro de uma faixa (ex.: viagem, feriado). */
export async function alternarDia(janelaId: string, data: string): Promise<Resultado> {
  const m = await instrutorLogado();
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return falha("Sem permissão.");
  const j = await db.atendimentoJanela.findFirst({ where: { id: janelaId, instrutorId: m.id } });
  if (!j) return falha("Faixa não encontrada.");
  const fechadas = j.datasFechadas.includes(data) ? j.datasFechadas.filter((d) => d !== data) : [...j.datasFechadas, data];
  await db.atendimentoJanela.update({ where: { id: j.id }, data: { datasFechadas: fechadas } });
  atualizar();
  return { ok: true };
}

/** Fecha ou reabre um horário avulso (só se ninguém marcou). */
export async function alternarHorario(inicioISO: string): Promise<Resultado> {
  const m = await instrutorLogado();
  if (!m) return falha("Sem permissão.");
  const inicio = new Date(inicioISO);
  const existente = await db.atendimentoReserva.findFirst({ where: { instrutorId: m.id, inicio, status: { in: ["marcada", "bloqueio"] } } });
  if (existente?.status === "marcada") return falha("Esse horário já tem uma conversa marcada. Cancele a conversa, se precisar.");
  if (existente) {
    await db.atendimentoReserva.delete({ where: { id: existente.id } });
  } else {
    const { horarios } = await horariosDoInstrutor(m.id, { incluirFechados: true });
    const h = horarios.find((x) => x.inicio.getTime() === inicio.getTime());
    if (!h) return falha("Horário não encontrado nas suas faixas.");
    try {
      await db.atendimentoReserva.create({ data: { schoolId: m.schoolId, instrutorId: m.id, janelaId: h.janelaId, inicio: h.inicio, fim: h.fim, modalidade: h.modalidade, status: "bloqueio" } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return falha("Alguém acabou de marcar esse horário.");
      throw e;
    }
  }
  atualizar();
  return { ok: true };
}

/** Depois da conversa: realizada ou o aluno faltou. */
export async function registrarResultado(id: string, status: "realizada" | "faltou"): Promise<Resultado> {
  const m = await instrutorLogado();
  if (!m || !["realizada", "faltou"].includes(status)) return falha("Sem permissão.");
  const r = await db.atendimentoReserva.updateMany({ where: { id, instrutorId: m.id, status: { in: ["marcada", "realizada", "faltou"] }, inicio: { lte: new Date() } }, data: { status } });
  if (!r.count) return falha("Só dá para registrar depois do horário da conversa.");
  atualizar();
  return { ok: true };
}

// ───────────────────────── Aluno: marcar e cancelar ─────────────────────────

export async function marcarAtendimento(instrutorId: string, inicioISO: string, assunto: string, modalidadeEscolhida?: string): Promise<Resultado> {
  const aluno = await getAuthenticatedMember();
  if (!aluno || !aluno.mercurioAtivo) return falha("Entre no Portal para marcar.");
  if (!(await podeMarcarCom(aluno.id, instrutorId))) return falha("Você só pode marcar com os instrutores das suas turmas.");
  const jaTem = await db.atendimentoReserva.count({ where: { alunoId: aluno.id, instrutorId, status: "marcada", inicio: { gte: new Date() } } });
  if (jaTem) return falha("Você já tem uma conversa marcada com este instrutor. Depois dela, marque outra.");
  const inicio = new Date(inicioISO);
  const { horarios, fuso } = await horariosDoInstrutor(instrutorId);
  const h = horarios.find((x) => x.inicio.getTime() === inicio.getTime());
  if (!h) return falha("Esse horário não está mais disponível. Escolha outro.");
  const modalidade = h.modalidade === "ambos" ? (modalidadeEscolhida === "online" ? "online" : "presencial") : h.modalidade;
  const instrutor = await db.member.findUniqueOrThrow({ where: { id: instrutorId }, select: { schoolId: true } });
  try {
    await db.atendimentoReserva.create({
      data: {
        schoolId: instrutor.schoolId,
        instrutorId,
        alunoId: aluno.id,
        janelaId: h.janelaId,
        inicio: h.inicio,
        fim: h.fim,
        modalidade,
        local: modalidade === "online" ? null : h.local,
        linkOnline: modalidade === "presencial" ? null : h.linkOnline,
        assunto: assunto.trim().slice(0, 500) || null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return falha("Alguém acabou de marcar esse horário. Escolha outro.");
    throw e;
  }
  void avisarSemEsperar([instrutorId], {
    titulo: "Nova conversa marcada",
    corpo: `${primeiroNome(aluno.name)} marcou ${quando(h.inicio, fuso)} (${MODALIDADES[modalidade as keyof typeof MODALIDADES]}).`,
    url: "/professor/atendimentos",
    etiqueta: `atendimento-${instrutorId}`,
  });
  atualizar();
  return { ok: true };
}

/** Cancela uma conversa marcada, pelo aluno ou pelo instrutor; o outro é avisado. */
export async function cancelarAtendimento(id: string, motivo: string): Promise<Resultado> {
  const m = await getAuthenticatedMember();
  if (!m) return falha("Entre no Portal.");
  const r = await db.atendimentoReserva.findFirst({
    where: { id, status: "marcada", OR: [{ alunoId: m.id }, { instrutorId: m.id }] },
    include: { aluno: { select: { name: true } }, instrutor: { select: { name: true, school: { select: { uf: true } } } } },
  });
  if (!r) return falha("Conversa não encontrada.");
  if (r.inicio <= new Date()) return falha("Essa conversa já começou.");
  const porAluno = r.alunoId === m.id;
  await db.atendimentoReserva.update({
    where: { id: r.id },
    data: { status: "cancelada", canceladoPor: porAluno ? "aluno" : "instrutor", canceladoEm: new Date(), motivoCancelamento: motivo.trim().slice(0, 300) || null },
  });
  const fuso = fusoDaEscola(r.instrutor.school.uf);
  const outro = porAluno ? r.instrutorId : r.alunoId;
  if (outro)
    void avisarSemEsperar([outro], {
      titulo: "Conversa cancelada",
      corpo: `${primeiroNome(porAluno ? (r.aluno?.name ?? "O aluno") : r.instrutor.name)} cancelou a conversa de ${quando(r.inicio, fuso)}.${motivo.trim() ? ` Motivo: ${motivo.trim().slice(0, 120)}` : ""}`,
      url: porAluno ? "/professor/atendimentos" : "/atendimentos",
      etiqueta: `atendimento-cancelado-${r.id}`,
    });
  atualizar();
  return { ok: true };
}

