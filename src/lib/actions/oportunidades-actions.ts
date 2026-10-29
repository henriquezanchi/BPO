"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { candidatoElegivel, ehTipoGrupo } from "@/lib/grupos-portal";
import { AREAS_OPORTUNIDADE } from "@/lib/oportunidades-comum";
import {
  estaAberta,
  gestaoDeOportunidades,
  gruposVinculaveis,
  hojeDaFilial,
  oportunidadesParaMembro,
  podeGerir,
  podeVerOportunidades,
  responsaveisPossiveis,
} from "@/lib/oportunidades";
import { avisarSemEsperar } from "@/lib/push";
import { revalidatePath } from "next/cache";

/** Oportunidades de voluntariado (pedido do usuário 2026-10-29). Cada ação reconfere a permissão (lib/oportunidades.ts). */
class OportunidadeErro extends Error {}
type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

async function executar<T extends object>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof OportunidadeErro) return { ok: false, error: e.message };
    console.error("[Oportunidades] falha", e instanceof Error ? e.message : e);
    return { ok: false, error: "Não foi possível concluir. Atualize a página e tente de novo." };
  }
}

async function eu() {
  const m = await getAuthenticatedMember();
  if (!m) throw new OportunidadeErro("Entre no Portal de novo.");
  if (!m.mercurioAtivo) throw new OportunidadeErro("Sua matrícula não está ativa — fale com a secretaria da escola.");
  return m;
}

function atualizar() {
  revalidatePath("/voluntario/oportunidades");
  revalidatePath("/portal");
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const primeiroNome = (nome: string) => nome.split(" ")[0];

export type DadosOportunidade = {
  id?: string;
  schoolId: string;
  titulo: string;
  area: string;
  descricao: string;
  tipo: "pontual" | "continua";
  data: string | null;
  horario: string | null;
  vagas: number | null;
  abertaAte: string | null;
  grupoId: string | null;
  responsavelId: string;
};

export async function salvarOportunidade(d: DadosOportunidade) {
  return executar(async () => {
    const m = await eu();
    const g = await gestaoDeOportunidades(m);
    const anterior = d.id ? await db.oportunidadeVoluntariado.findUnique({ where: { id: d.id } }) : null;
    if (d.id && (!anterior || !podeGerir(m, g, anterior))) throw new OportunidadeErro("Você não pode alterar esta oportunidade.");
    const schoolId = anterior?.schoolId ?? d.schoolId;
    if (!anterior && !(g.escolas.includes(schoolId) || (g.responsavel && schoolId === m.schoolId))) throw new OportunidadeErro("Você não cadastra oportunidades nesta filial.");

    const titulo = d.titulo.trim().slice(0, 120);
    const descricao = d.descricao.trim().slice(0, 1500);
    const horario = d.horario?.trim().slice(0, 80) || null;
    if (titulo.length < 3) throw new OportunidadeErro("Dê um título à oportunidade.");
    if (!descricao) throw new OportunidadeErro("Conte o que a pessoa vai fazer.");
    if (!AREAS_OPORTUNIDADE.includes(d.area)) throw new OportunidadeErro("Escolha a área.");
    if (d.tipo !== "pontual" && d.tipo !== "continua") throw new OportunidadeErro("Escolha se é um dia só ou contínua.");
    if (d.tipo === "continua" && !horario) throw new OportunidadeErro("Informe quando acontece (ex.: Quintas, 19h às 21h).");
    const data = d.tipo === "pontual" && d.data ? d.data : null;
    if (data && !DATA.test(data)) throw new OportunidadeErro("Data inválida.");
    if (d.abertaAte && !DATA.test(d.abertaAte)) throw new OportunidadeErro("Prazo inválido.");
    const vagas = d.vagas == null || Number.isNaN(d.vagas) ? null : Math.trunc(d.vagas);
    if (vagas != null && (vagas < 1 || vagas > 200)) throw new OportunidadeErro("Vagas: de 1 a 200, ou deixe em branco.");
    if (!anterior) {
      const hoje = hojeDaFilial((await db.school.findUnique({ where: { id: schoolId }, select: { uf: true } }))?.uf);
      if (data && data < hoje) throw new OportunidadeErro("A data já passou.");
    }
    if (d.grupoId && !(await gruposVinculaveis(m, g, schoolId)).some((x) => x.id === d.grupoId)) throw new OportunidadeErro("Grupo não disponível.");
    if (!(await responsaveisPossiveis(m, g, schoolId)).some((x) => x.id === d.responsavelId)) throw new OportunidadeErro("Escolha o responsável.");

    const campos = { titulo, area: d.area, descricao, tipo: d.tipo, data, horario, vagas, abertaAte: d.abertaAte || null, grupoId: d.grupoId || null, responsavelId: d.responsavelId };
    const op = anterior
      ? await db.oportunidadeVoluntariado.update({ where: { id: anterior.id }, data: campos })
      : await db.oportunidadeVoluntariado.create({ data: { ...campos, schoolId, criadoPorId: m.id } });
    if (op.responsavelId !== m.id && op.responsavelId !== anterior?.responsavelId)
      avisarSemEsperar([op.responsavelId], {
        titulo: "Você é responsável por uma oportunidade",
        corpo: `${primeiroNome(m.name)} indicou você para “${op.titulo}”. Os interessados chegam para você.`,
        url: "/voluntario/oportunidades",
        etiqueta: `oportunidade-${op.id}`,
      });
    atualizar();
    return { id: op.id };
  });
}

export async function encerrarOportunidade(id: string, encerrar: boolean) {
  return executar(async () => {
    const m = await eu();
    const op = await db.oportunidadeVoluntariado.findUnique({ where: { id } });
    if (!op || !podeGerir(m, await gestaoDeOportunidades(m), op)) throw new OportunidadeErro("Você não pode alterar esta oportunidade.");
    await db.oportunidadeVoluntariado.update({ where: { id }, data: { encerradaEm: encerrar ? new Date() : null } });
    atualizar();
    return {};
  });
}

export async function responderInteresse(interesseId: string, resposta: "aceito" | "recusado") {
  return executar(async () => {
    const m = await eu();
    const i = await db.interesseVoluntariado.findUnique({ where: { id: interesseId }, include: { oportunidade: true } });
    if (!i || !podeGerir(m, await gestaoDeOportunidades(m), i.oportunidade)) throw new OportunidadeErro("Você não responde por esta oportunidade.");
    if (i.status !== "pendente") throw new OportunidadeErro("Este pedido já foi respondido.");
    if (resposta !== "aceito" && resposta !== "recusado") throw new OportunidadeErro("Resposta inválida.");
    const op = i.oportunidade;

    // Aceito entra no grupo vinculado (secretaria ou GDVE), com as mesmas regras de quem adiciona pela tela do grupo.
    let grupo: string | null = null;
    let foraDoGrupo: string | null = null;
    if (resposta === "aceito" && op.grupoId) {
      const cg = await db.classGroup.findUnique({ where: { id: op.grupoId }, select: { name: true, tipo: true, schoolId: true, permiteAlunos: true, arquivadoEm: true } });
      if (cg && !cg.arquivadoEm && ehTipoGrupo(cg.tipo)) {
        foraDoGrupo = await candidatoElegivel(cg.tipo, cg.schoolId, cg.permiteAlunos, i.memberId);
        if (!foraDoGrupo) {
          await db.classMembership.createMany({ data: [{ classGroupId: op.grupoId, memberId: i.memberId, role: "aluno" }], skipDuplicates: true });
          // Secretaria: quem entra passa a ver a área de voluntários, como em grupos-actions.ts (e recebe as boas-vindas).
          if (cg.tipo === "SEC") await db.acessoVoluntario.createMany({ data: [{ memberId: i.memberId, liberadoPorId: m.id }], skipDuplicates: true });
          grupo = cg.name;
        }
      }
    }
    await db.interesseVoluntariado.update({ where: { id: i.id }, data: { status: resposta, respondidoPorId: m.id, respondidoEm: new Date() } });
    const responsavel = await db.member.findUnique({ where: { id: op.responsavelId }, select: { name: true } });
    avisarSemEsperar(
      [i.memberId],
      resposta === "aceito"
        ? { titulo: "Você foi aceito como voluntário", corpo: `“${op.titulo}”: ${primeiroNome(responsavel?.name ?? m.name)} vai combinar os detalhes com você. Obrigado!`, url: "/portal?abrir=voluntariado", etiqueta: `interesse-${i.id}` }
        : { titulo: "Obrigado por se oferecer", corpo: `Desta vez “${op.titulo}” não vai precisar da sua ajuda. Fique de olho nas próximas oportunidades!`, url: "/portal?abrir=voluntariado", etiqueta: `interesse-${i.id}` },
    );
    atualizar();
    return { grupo, foraDoGrupo };
  });
}

/** O membro se oferece para uma oportunidade aberta da própria filial. */
export async function quererAjudar(oportunidadeId: string, recado: string) {
  return executar(async () => {
    const m = await eu();
    if (!(await podeVerOportunidades(m))) throw new OportunidadeErro("O voluntariado é aberto aos membros da escola.");
    const op = await db.oportunidadeVoluntariado.findUnique({ where: { id: oportunidadeId }, include: { interesses: { select: { memberId: true, status: true } } } });
    if (!op || op.schoolId !== m.schoolId || !estaAberta(op, hojeDaFilial(m.school.uf))) throw new OportunidadeErro("Esta oportunidade não está mais aberta.");
    if (op.vagas != null && op.interesses.filter((x) => x.status === "aceito").length >= op.vagas) throw new OportunidadeErro("As vagas já foram preenchidas.");
    const meu = op.interesses.find((x) => x.memberId === m.id);
    if (meu && meu.status !== "desistiu") throw new OportunidadeErro("Você já se ofereceu para esta oportunidade.");
    const texto = recado.trim().slice(0, 300) || null;
    await db.interesseVoluntariado.upsert({
      where: { oportunidadeId_memberId: { oportunidadeId, memberId: m.id } },
      create: { oportunidadeId, memberId: m.id, recado: texto },
      update: { recado: texto, status: "pendente", respondidoPorId: null, respondidoEm: null, createdAt: new Date() },
    });
    avisarSemEsperar([op.responsavelId], {
      titulo: "Alguém quer ajudar",
      corpo: `${m.name.split(" ").slice(0, 2).join(" ")} se ofereceu para “${op.titulo}”.`,
      url: "/voluntario/oportunidades",
      etiqueta: `oportunidade-${op.id}`,
    });
    atualizar();
    return {};
  });
}

export async function desistirDeAjudar(oportunidadeId: string) {
  return executar(async () => {
    const m = await eu();
    const i = await db.interesseVoluntariado.findUnique({ where: { oportunidadeId_memberId: { oportunidadeId, memberId: m.id } }, include: { oportunidade: true } });
    if (!i || (i.status !== "pendente" && i.status !== "aceito")) throw new OportunidadeErro("Não há oferta sua para desfazer.");
    await db.interesseVoluntariado.update({ where: { id: i.id }, data: { status: "desistiu" } });
    if (i.status === "aceito")
      avisarSemEsperar([i.oportunidade.responsavelId], {
        titulo: "Um voluntário desistiu",
        corpo: `${m.name.split(" ").slice(0, 2).join(" ")} não poderá mais ajudar em “${i.oportunidade.titulo}”.`,
        url: "/voluntario/oportunidades",
        etiqueta: `oportunidade-${i.oportunidade.id}`,
      });
    atualizar();
    return {};
  });
}

/** Para o quadro Voluntariado do Portal. */
export async function carregarOportunidades() {
  const m = await getAuthenticatedMember();
  if (!m || !m.mercurioAtivo) return [];
  return oportunidadesParaMembro(m);
}
