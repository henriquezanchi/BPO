"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { datasPermitidas, PRATICA_TRATAK } from "@/lib/diario";
import { hojeDaPessoa } from "@/lib/diario-dados";
import { CHAVES_DEGRAU, CHAVES_PRATICA_FV, CONDICOES, ETAPAS_TEMPLO, minutosDe, PERGUNTAS_PRESENCA, pareceLeitura, UNIDADES, type Calendario, type ChavePresenca, type TarefaGdve } from "@/lib/fv/comum";
import { carregarHistoricoFv, diasDaCarta, temDiarioFv } from "@/lib/fv/dados";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Diário de FV (pedido do usuário 2026-10-31): cada ação grava só no diário de quem está logado, em hoje ou nos 3 dias
 * anteriores, e só para quem participa de um GDVE. Ninguém mais lê nem grava (nem a coordenação do GDVE).
 */
type Resultado = { ok: true } | { ok: false; error: string };

class FvErro extends Error {}

async function eu() {
  const m = await getAuthenticatedMember();
  if (!m) throw new FvErro("Entre no Portal.");
  if (!(await temDiarioFv(m))) throw new FvErro("O diário de FV é para quem participa de um GDVE.");
  return m;
}

async function euNoDia(data: string) {
  const m = await eu();
  if (!datasPermitidas(hojeDaPessoa(m)).includes(data)) throw new FvErro("Dá para preencher só hoje e os 3 dias anteriores.");
  return m;
}

async function executar(fn: () => Promise<void>): Promise<Resultado> {
  try {
    await fn();
    revalidatePath("/grupos/[id]", "page");
    revalidatePath("/diario/fv");
    return { ok: true };
  } catch (e) {
    console.error("Diário de FV:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof FvErro ? e.message : "Não foi possível salvar agora. Tente de novo." };
  }
}

const texto = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const dataValida = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const horaValida = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : undefined);

/** Lê o dia (ou cria) e grava só os campos indicados, em transação. */
async function noDia(memberId: string, data: string, alterar: (atual: { praticas: Record<string, boolean>; gdveTarefas: Record<string, number> }) => Prisma.DiarioFvDiaUpdateInput) {
  await db.$transaction(async (tx) => {
    const atual = await tx.diarioFvDia.findUnique({ where: { memberId_data: { memberId, data } }, select: { praticas: true, gdveTarefas: true } });
    const dados = alterar({ praticas: (atual?.praticas ?? {}) as Record<string, boolean>, gdveTarefas: (atual?.gdveTarefas ?? {}) as Record<string, number> });
    await tx.diarioFvDia.upsert({
      where: { memberId_data: { memberId, data } },
      update: { ...dados, origem: "portal" },
      create: { ...(dados as Omit<Prisma.DiarioFvDiaUncheckedCreateInput, "memberId" | "data">), memberId, data },
    });
  });
}

/** Degrau (A Escalada): os textos dos itens da Carta de Degrau no dia. */
export async function salvarDegrau(data: string, itens: Record<string, string>): Promise<Resultado> {
  return executar(async () => {
    const m = await euNoDia(data);
    const limpos = Object.fromEntries(CHAVES_DEGRAU.map((k) => [k, texto(itens?.[k])]).filter(([, v]) => v));
    await noDia(m.id, data, () => ({ itens: limpos as Prisma.InputJsonValue }));
  });
}

/** Forja: marca ou desmarca uma prática no dia. O Tratak fica nas práticas do diário comum. */
export async function marcarPraticaFv(data: string, chave: string, feita: boolean): Promise<Resultado> {
  return executar(async () => {
    const m = await euNoDia(data);
    if (chave === PRATICA_TRATAK) {
      await db.$transaction(async (tx) => {
        const dia = await tx.diarioDia.findUnique({ where: { memberId_data: { memberId: m.id, data } }, select: { praticas: true } });
        const praticas = { ...((dia?.praticas ?? {}) as Record<string, boolean>) };
        if (feita) praticas[PRATICA_TRATAK] = true;
        else delete praticas[PRATICA_TRATAK];
        const valor = praticas as Prisma.InputJsonValue;
        await tx.diarioDia.upsert({ where: { memberId_data: { memberId: m.id, data } }, update: { praticas: valor, origem: "portal" }, create: { memberId: m.id, data, praticas: valor } });
      });
      return;
    }
    if (!CHAVES_PRATICA_FV.includes(chave as never)) throw new FvErro("Prática não reconhecida.");
    await noDia(m.id, data, ({ praticas }) => {
      const novas = { ...praticas };
      if (feita) novas[chave] = true;
      else delete novas[chave];
      return { praticas: novas };
    });
  });
}

/** Templo Interior: até qual etapa a pessoa se manteve consciente (as quatro de uma vez, como no diário antigo). */
export async function salvarTemplo(data: string, etapas: string[]): Promise<Resultado> {
  return executar(async () => {
    const m = await euNoDia(data);
    await noDia(m.id, data, ({ praticas }) => {
      const novas = { ...praticas };
      for (const { chave } of ETAPAS_TEMPLO) {
        if (etapas.includes(chave)) novas[chave] = true;
        else delete novas[chave];
      }
      return { praticas: novas };
    });
  });
}

/** Balanço de Serviço e Atividades: presenças do dia e horas de serviço avulso ("HH:MM"). */
export async function salvarBalanco(data: string, presencas: Partial<Record<ChavePresenca, string>>, voluntariado: string): Promise<Resultado> {
  return executar(async () => {
    const m = await euNoDia(data);
    const validas = Object.fromEntries(PERGUNTAS_PRESENCA.flatMap(({ chave }) => (presencas?.[chave] === "Sim" || presencas?.[chave] === "Não" ? [[chave, presencas[chave]]] : [])));
    const minutos = minutosDe(voluntariado);
    if (voluntariado && minutos === null) throw new FvErro("Informe as horas no formato 01:30.");
    await noDia(m.id, data, () => ({ presencas: validas, minutosVoluntariado: minutos }));
  });
}

/** Ficha: Mestre e Carta, condição, unidade e calendário fixo de atividades. */
export async function salvarFicha(f: { unidade: string; condicao: string; mestre: string; ultimoEncontro: string; ultimaCarta: string; proximaCarta: string; calendario: Calendario }): Promise<Resultado> {
  return executar(async () => {
    const m = await eu();
    const c = f.calendario ?? {};
    const dia = (v: unknown) => (typeof v === "string" && /^[0-6]$/.test(v) ? v : undefined);
    const dias = [...new Set((c.aulaMinistradaDias ?? []).filter((d) => /^[0-6]$/.test(d)))];
    const calendario: Calendario = {
      aulaRegularDia: dia(c.aulaRegularDia),
      aulaRegularHora: horaValida(c.aulaRegularHora),
      aulaRegularFim: horaValida(c.aulaRegularFim),
      reuniaoRaioDia: dia(c.reuniaoRaioDia),
      reuniaoRaioHora: horaValida(c.reuniaoRaioHora),
      reuniaoRaioFim: horaValida(c.reuniaoRaioFim),
      aulaMinistradaDias: dias,
      aulaMinistradaTempos: Object.fromEntries(dias.map((d) => [d, { inicio: horaValida(c.aulaMinistradaTempos?.[d]?.inicio), fim: horaValida(c.aulaMinistradaTempos?.[d]?.fim) }])),
      dataCrm: dataValida(c.dataCrm) ?? undefined,
      dataAulaEd: dataValida(c.dataAulaEd) ?? undefined,
    };
    const dados = {
      unidade: UNIDADES.includes(f.unidade) ? f.unidade : null,
      condicao: CONDICOES.includes(f.condicao) ? f.condicao : null,
      mestre: texto(f.mestre, 160) || null,
      ultimoEncontro: dataValida(f.ultimoEncontro),
      ultimaCarta: dataValida(f.ultimaCarta),
      proximaCarta: dataValida(f.proximaCarta),
      calendario: JSON.parse(JSON.stringify(calendario)) as Prisma.InputJsonValue,
    };
    await db.diarioFvFicha.upsert({ where: { memberId: m.id }, update: dados, create: { memberId: m.id, ...dados } });
  });
}

async function fichaDe(memberId: string) {
  const f = await db.diarioFvFicha.findUnique({ where: { memberId }, select: { tarefas: true, ciclo: true } });
  return { tarefas: (f?.tarefas ?? []) as TarefaGdve[], ciclo: (f?.ciclo ?? {}) as Record<string, boolean> };
}

/** Módulo GDVE: cria ou edita uma prática específica do ciclo. */
export async function salvarTarefa(t: { id?: string; nome: string; meta: number; ciclo: boolean }): Promise<Resultado> {
  return executar(async () => {
    const m = await eu();
    const nome = texto(t.nome, 160);
    if (!nome) throw new FvErro("Escreva o nome da prática.");
    const meta = Math.min(Math.max(Math.round(Number(t.meta) || 1), 1), 10);
    const { tarefas } = await fichaDe(m.id);
    // Nova tarefa com cara de leitura (Bastião) nasce como Missão do Ciclo, como no diário antigo.
    const ciclo = t.id ? !!t.ciclo : !!t.ciclo || pareceLeitura(nome);
    const lista = t.id ? tarefas.map((x) => (x.id === t.id ? { ...x, nome, meta: ciclo ? 1 : meta, ciclo } : x)) : [...tarefas, { id: `gdve_${Date.now()}`, nome, meta: ciclo ? 1 : meta, ciclo }];
    if (lista.length > 40) throw new FvErro("Limite de 40 práticas no ciclo.");
    await db.diarioFvFicha.upsert({ where: { memberId: m.id }, update: { tarefas: lista }, create: { memberId: m.id, tarefas: lista } });
  });
}

export async function excluirTarefa(id: string): Promise<Resultado> {
  return executar(async () => {
    const m = await eu();
    const { tarefas, ciclo } = await fichaDe(m.id);
    const resto = { ...ciclo };
    delete resto[id];
    await db.diarioFvFicha.update({ where: { memberId: m.id }, data: { tarefas: tarefas.filter((x) => x.id !== id), ciclo: resto } });
  });
}

/** Toque na tarefa: missão do ciclo alterna feita; diária soma 1 até a meta e depois volta a 0. */
export async function marcarTarefa(data: string, id: string): Promise<Resultado> {
  return executar(async () => {
    const m = await euNoDia(data);
    const { tarefas, ciclo } = await fichaDe(m.id);
    const t = tarefas.find((x) => x.id === id);
    if (!t) throw new FvErro("Prática não encontrada.");
    if (t.ciclo) {
      await db.diarioFvFicha.update({ where: { memberId: m.id }, data: { ciclo: { ...ciclo, [id]: !ciclo[id] } } });
      return;
    }
    await noDia(m.id, data, ({ gdveTarefas }) => {
      const atual = Number(gdveTarefas[id]) || 0;
      return { gdveTarefas: { ...gdveTarefas, [id]: atual + 1 > t.meta ? 0 : atual + 1 } };
    });
  });
}

/**
 * Presença na reunião do GDVE no dia. Ao marcar, a pessoa escolhe se zera as missões do ciclo (no diário antigo,
 * marcar a presença também agendava a próxima reunião; no Portal a reunião vem dos encontros do grupo).
 */
export async function marcarPresencaGdve(data: string, presente: boolean, zerarCiclo: boolean): Promise<Resultado> {
  return executar(async () => {
    const m = await euNoDia(data);
    await noDia(m.id, data, () => ({ gdvePresenca: presente }));
    if (presente && zerarCiclo) await db.diarioFvFicha.updateMany({ where: { memberId: m.id }, data: { ciclo: {} } });
  });
}

/** Histórico de FV de um mês (tela). */
export async function historicoFv(mes?: string) {
  return carregarHistoricoFv(await eu(), mes);
}

/** Dados do "Histórico da Carta de Degrau" (o texto é montado na tela). */
export async function dadosDaCartaFv() {
  return diasDaCarta(await eu());
}
