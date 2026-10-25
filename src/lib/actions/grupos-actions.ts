"use server";

import { ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { candidatoElegivel, ehFV, filtroCandidatos, papelNoGrupo, podeCriarEstudo, TIPOS_DO_PORTAL, type TipoDoPortal, type TipoGrupo } from "@/lib/grupos-portal";
import { consultarMercurio } from "@/lib/mercurio-db/client";
import { podeAdministrar } from "@/lib/recursos-filial";
import { sugerirSecretarias, type FuncaoMercurio } from "@/lib/secretarias";
import { revalidatePath } from "next/cache";

/**
 * GAF, GDVE, secretarias e atividades dos grupos (pedido do usuário
 * 2026-10-19). Toda ação reconfere a permissão no servidor (grupos-portal.ts).
 */
class GrupoErro extends Error {}
type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

async function executar<T extends object>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof GrupoErro) return { ok: false, error: e.message };
    console.error("[Grupos] falha", e instanceof Error ? e.message : e);
    return { ok: false, error: "Não foi possível concluir. Atualize a página e tente de novo." };
  }
}

async function eu() {
  const m = await getAuthenticatedMember();
  if (!m || !m.mercurioAtivo) throw new GrupoErro("Entre no Portal com um cadastro ativo.");
  return m;
}

async function exigirGestor(grupoId: string) {
  const m = await eu();
  const papel = await papelNoGrupo(m, grupoId);
  if (!papel.podeGerir) throw new GrupoErro("Você não é responsável por este grupo.");
  return { m, papel };
}

/** Nome é único por filial entre todos os grupos e turmas: avisa com clareza em vez do erro do banco. */
async function exigirNomeLivre(schoolId: string, nome: string, excetoId?: string) {
  const outro = await db.classGroup.findFirst({
    where: { schoolId, name: { equals: nome, mode: "insensitive" }, ...(excetoId ? { id: { not: excetoId } } : {}) },
    select: { tipo: true },
  });
  if (outro) throw new GrupoErro(`Já existe ${outro.tipo === "turma" ? "uma turma" : "um grupo"} com o nome “${nome}” nesta filial. Escolha outro nome.`);
}

async function administra(m: Awaited<ReturnType<typeof eu>>, schoolId: string) {
  return (await podeAdministrar(m, schoolId)) || (await ehAdministradorNacional(m));
}

/** Quem entra numa secretaria passa a ver a área de voluntários (liberado por quem adicionou). */
async function garantirAcesso(liberadorId: string, memberIds: string[]) {
  if (!memberIds.length) return;
  await db.acessoVoluntario.createMany({ data: memberIds.map((memberId) => ({ memberId, liberadoPorId: liberadorId })), skipDuplicates: true });
}

function atualizar(grupoId?: string) {
  revalidatePath("/admin");
  revalidatePath("/voluntario");
  revalidatePath("/portal");
  if (grupoId) revalidatePath(`/grupos/${grupoId}`);
}

const MODALIDADES = ["presencial", "online", "misto"];

type CamposGrupo = {
  nome: string;
  descricao?: string;
  modalidade?: string;
  local?: string;
  linkOnline?: string;
  permiteAlunos?: boolean;
  programa?: string;
};

function validarCampos(c: CamposGrupo) {
  const nome = c.nome?.trim() ?? "";
  if (nome.length < 2 || nome.length > 80) throw new GrupoErro("Dê um nome de 2 a 80 caracteres.");
  if (c.modalidade && !MODALIDADES.includes(c.modalidade)) throw new GrupoErro("Modalidade inválida.");
  let link: string | null = null;
  if (c.linkOnline?.trim()) {
    try {
      const u = new URL(c.linkOnline.trim());
      if (u.protocol !== "https:") throw new Error();
      link = u.href;
    } catch {
      throw new GrupoErro("O link do encontro online precisa começar com https://");
    }
  }
  if ((c.descricao?.length ?? 0) > 2000 || (c.programa?.length ?? 0) > 8000) throw new GrupoErro("Texto longo demais.");
  return {
    name: nome,
    descricao: c.descricao?.trim() || null,
    modalidade: c.modalidade || null,
    local: c.local?.trim() || null,
    linkOnline: link,
    permiteAlunos: !!c.permiteAlunos,
    programa: c.programa?.trim() || null,
  };
}

export async function criarGrupo(input: CamposGrupo & { schoolId: string; tipo: TipoDoPortal; responsaveis: string[]; integrantes: string[] }) {
  return executar(async () => {
    const m = await eu();
    const tipo = input.tipo;
    if (!(TIPOS_DO_PORTAL as readonly string[]).includes(tipo)) throw new GrupoErro("Tipo de grupo inválido.");
    if (tipo === "ESTUDO" || tipo === "LEITURA") {
      if (!(await podeCriarEstudo(m, input.schoolId))) throw new GrupoErro("Grupo de estudo e leitura comentada são criados por instrutores, direção, administração e Escolástica da filial.");
    } else if (tipo === "GDVE") {
      if (m.schoolId !== input.schoolId || !(await ehFV(m.id)) || !(await temAcessoVoluntario(m))) throw new GrupoErro("O GDVE é criado por FV da própria filial.");
    } else if (!(await administra(m, input.schoolId))) throw new GrupoErro("Só a administração da filial cria GAF e secretarias.");
    const dados = validarCampos(input);
    await exigirNomeLivre(input.schoolId, dados.name);
    const responsaveis = [...new Set([...(tipo === "GDVE" ? [m.id] : []), ...input.responsaveis])];
    const integrantes = [...new Set(input.integrantes)].filter((id) => !responsaveis.includes(id));
    for (const id of [...responsaveis, ...integrantes]) {
      const motivo = await candidatoElegivel(tipo, input.schoolId, dados.permiteAlunos, id);
      // Na secretaria e no GAF, responsável pode ser qualquer ativo da filial (instrutor, dirigente).
      if (motivo && !(responsaveis.includes(id) && tipo !== "GDVE" && motivo.startsWith("Este GAF"))) throw new GrupoErro(motivo);
    }
    const grupo = await db.classGroup.create({ data: { schoolId: input.schoolId, tipo, criadoPorId: m.id, ...dados } });
    await db.classMembership.createMany({
      data: [...responsaveis.map((memberId) => ({ classGroupId: grupo.id, memberId, role: "professor" as const })), ...integrantes.map((memberId) => ({ classGroupId: grupo.id, memberId, role: "aluno" as const }))],
      skipDuplicates: true,
    });
    if (tipo === "SEC") await garantirAcesso(m.id, [...responsaveis, ...integrantes]);
    atualizar(grupo.id);
    return { id: grupo.id };
  });
}

export async function editarGrupo(grupoId: string, campos: CamposGrupo) {
  return executar(async () => {
    const { papel } = await exigirGestor(grupoId);
    const dados = validarCampos(campos);
    await exigirNomeLivre(papel.schoolId, dados.name, grupoId);
    await db.classGroup.update({ where: { id: grupoId }, data: dados });
    atualizar(grupoId);
    return {};
  });
}

export async function arquivarGrupo(grupoId: string) {
  return executar(async () => {
    const { m, papel } = await exigirGestor(grupoId);
    if (papel.tipo !== "GDVE" && !(await administra(m, papel.schoolId))) throw new GrupoErro("Só a administração da filial encerra GAF e secretarias.");
    if (!(TIPOS_DO_PORTAL as readonly string[]).includes(papel.tipo)) throw new GrupoErro("Grupos do Mercúrio não são encerrados pelo Portal.");
    await db.classGroup.update({ where: { id: grupoId }, data: { arquivadoEm: new Date() } });
    atualizar(grupoId);
    return {};
  });
}

export async function adicionarPessoas(grupoId: string, role: "professor" | "aluno", memberIds: string[]) {
  return executar(async () => {
    const { m, papel } = await exigirGestor(grupoId);
    const g = await db.classGroup.findUniqueOrThrow({ where: { id: grupoId }, select: { permiteAlunos: true } });
    if (role === "professor" && papel.tipo !== "GDVE" && !(await administra(m, papel.schoolId)) && !papel.responsavel)
      throw new GrupoErro("Só a administração define os responsáveis.");
    const ids = [...new Set(memberIds)].slice(0, 200);
    for (const id of ids) {
      const motivo = await candidatoElegivel(papel.tipo, papel.schoolId, g.permiteAlunos, id);
      if (motivo && !(role === "professor" && papel.tipo !== "GDVE" && motivo.startsWith("Este GAF"))) throw new GrupoErro(motivo);
    }
    await db.classMembership.createMany({ data: ids.map((memberId) => ({ classGroupId: grupoId, memberId, role })), skipDuplicates: true });
    if (papel.tipo === "SEC") await garantirAcesso(m.id, ids);
    atualizar(grupoId);
    return { adicionados: ids.length };
  });
}

export async function removerPessoa(grupoId: string, role: "professor" | "aluno", memberId: string) {
  return executar(async () => {
    const { papel } = await exigirGestor(grupoId);
    if (!(TIPOS_DO_PORTAL as readonly string[]).includes(papel.tipo)) throw new GrupoErro("A composição deste grupo vem do Mercúrio.");
    if (role === "professor" && (await db.classMembership.count({ where: { classGroupId: grupoId, role: "professor" } })) <= 1)
      throw new GrupoErro("O grupo precisa de pelo menos um responsável.");
    await db.classMembership.deleteMany({ where: { classGroupId: grupoId, memberId, role } });
    // Atividades não ficam com responsável que saiu do grupo.
    const restantes = await db.classMembership.count({ where: { classGroupId: grupoId, memberId } });
    if (!restantes) {
      const atividades = await db.grupoAtividade.findMany({ where: { classGroupId: grupoId, responsaveis: { has: memberId } } });
      for (const a of atividades) await db.grupoAtividade.update({ where: { id: a.id }, data: { responsaveis: a.responsaveis.filter((r) => r !== memberId) } });
    }
    atualizar(grupoId);
    return {};
  });
}

/** Busca de pessoas que podem entrar (no grupo existente ou num novo, pela filial e tipo). */
export async function buscarCandidatos(alvo: { grupoId: string } | { schoolId: string; tipo: TipoGrupo; permiteAlunos: boolean }, termo: string) {
  const m = await eu();
  let schoolId: string, tipo: TipoGrupo, permiteAlunos: boolean;
  if ("grupoId" in alvo) {
    const papel = await papelNoGrupo(m, alvo.grupoId);
    if (!papel.podeGerir) return [];
    const g = await db.classGroup.findUniqueOrThrow({ where: { id: alvo.grupoId }, select: { permiteAlunos: true } });
    ({ schoolId, tipo } = papel);
    permiteAlunos = g.permiteAlunos;
  } else {
    ({ schoolId, tipo, permiteAlunos } = alvo);
    const pode = tipo === "GDVE" ? m.schoolId === schoolId && (await ehFV(m.id)) : await administra(m, schoolId);
    if (!pode) return [];
  }
  const t = termo.trim();
  return db.member.findMany({
    where: { ...filtroCandidatos(tipo, schoolId, permiteAlunos), ...(t ? { name: { contains: t, mode: "insensitive" as const } } : {}) },
    select: { id: true, name: true, isMembroPrograma: true },
    orderBy: { name: "asc" },
    take: 40,
  });
}

/** Responsáveis de GAF/secretaria: qualquer ativo da filial (instrutor, dirigente). */
export async function buscarResponsaveis(schoolId: string, termo: string) {
  const m = await eu();
  if (!(await administra(m, schoolId))) return [];
  const t = termo.trim();
  return db.member.findMany({
    where: { schoolId, mercurioAtivo: true, ...(t ? { name: { contains: t, mode: "insensitive" as const } } : {}) },
    select: { id: true, name: true, isMembroPrograma: true },
    orderBy: { name: "asc" },
    take: 40,
  });
}

// --- Atividades -------------------------------------------------------------

export async function salvarAtividade(grupoId: string, a: { id?: string; titulo: string; descricao?: string; responsaveis: string[]; periodicidade?: string; status?: string }) {
  return executar(async () => {
    const { m } = await exigirGestor(grupoId);
    const titulo = a.titulo?.trim() ?? "";
    if (titulo.length < 2 || titulo.length > 120) throw new GrupoErro("Dê um título de 2 a 120 caracteres.");
    const status = a.status ?? "ativa";
    if (!["ativa", "pausada", "concluida"].includes(status)) throw new GrupoErro("Situação inválida.");
    const membros = new Set((await db.classMembership.findMany({ where: { classGroupId: grupoId }, select: { memberId: true } })).map((x) => x.memberId));
    const responsaveis = [...new Set(a.responsaveis)];
    if (responsaveis.some((r) => !membros.has(r))) throw new GrupoErro("O responsável pela atividade precisa fazer parte do grupo.");
    const dados = { titulo, descricao: a.descricao?.trim() || null, responsaveis, periodicidade: a.periodicidade?.trim() || null, status };
    if (a.id) {
      const atual = await db.grupoAtividade.findUnique({ where: { id: a.id }, select: { classGroupId: true } });
      if (atual?.classGroupId !== grupoId) throw new GrupoErro("Atividade não encontrada.");
      await db.grupoAtividade.update({ where: { id: a.id }, data: dados });
    } else await db.grupoAtividade.create({ data: { classGroupId: grupoId, criadoPorId: m.id, ...dados } });
    atualizar(grupoId);
    return {};
  });
}

export async function removerAtividade(atividadeId: string) {
  return executar(async () => {
    const a = await db.grupoAtividade.findUnique({ where: { id: atividadeId }, select: { classGroupId: true } });
    if (!a) throw new GrupoErro("Atividade não encontrada.");
    await exigirGestor(a.classGroupId);
    await db.grupoAtividade.delete({ where: { id: atividadeId } });
    atualizar(a.classGroupId);
    return {};
  });
}

// --- Presença depois do encontro ------------------------------------------

export async function registrarPresenca(meetingId: string, participou: boolean, motivo: string | null, naoInformou: boolean) {
  return executar(async () => {
    const m = await eu();
    const r = await db.groupMeeting.findUnique({ where: { id: meetingId }, select: { classGroupId: true, startsAt: true, status: true } });
    if (!r || r.status === "cancelada") throw new GrupoErro("Encontro não encontrado ou cancelado.");
    const papel = await papelNoGrupo(m, r.classGroupId);
    if (!papel.podeVer || !(papel.integrante || papel.responsavel)) throw new GrupoErro("Você não participa deste grupo.");
    if (r.startsAt > new Date()) throw new GrupoErro("O encontro ainda não começou.");
    if (r.startsAt.getTime() < Date.now() - 30 * 864e5) throw new GrupoErro("Prazo para responder sobre este encontro encerrado.");
    const texto = participou || naoInformou ? null : (motivo ?? "").trim().slice(0, 600) || null;
    const dados = { participou, motivo: texto, naoInformou: !participou && naoInformou, respondidoEm: new Date() };
    await db.grupoPresenca.upsert({ where: { meetingId_memberId: { meetingId, memberId: m.id } }, create: { meetingId, memberId: m.id, ...dados }, update: dados });
    revalidatePath("/portal");
    return {};
  });
}

// --- Secretarias sugeridas pelo Mercúrio --------------------------------------

export type SugestaoComPessoas = {
  nome: string;
  jaExiste: boolean;
  responsaveis: { memberId: string | null; nome: string; funcao: string }[];
  equipe: { memberId: string | null; nome: string; funcao: string }[];
};

export async function getSugestoesSecretarias(schoolId: string): Promise<SugestaoComPessoas[]> {
  const m = await eu();
  if (!(await administra(m, schoolId))) return [];
  const escola = await db.school.findUnique({ where: { id: schoolId }, select: { mercurioUnidade: true } });
  const uni = escola?.mercurioUnidade?.replace(/[^A-Z0-9]/gi, "");
  if (!uni) return [];
  const funcoes = (await consultarMercurio(
    `SELECT d.dfn_matr matricula, d.dfn_funcao funcao, d.dfn_descricao descricao FROM dirigente_funcoes d JOIN cadastro c ON c.cad_matr=d.dfn_matr AND c.cad_situacao='ATI' WHERE d.dfn_atual='S' AND d.dfn_unidade='${uni}'`,
  )) as unknown as FuncaoMercurio[];
  const sugestoes = sugerirSecretarias(funcoes);
  const pessoas = await db.member.findMany({ where: { mercurioId: { in: [...new Set(funcoes.map((f) => f.matricula))] } }, select: { id: true, name: true, mercurioId: true, schoolId: true } });
  const porMatricula = new Map(pessoas.map((p) => [p.mercurioId, p]));
  const existentes = new Set(
    (await db.classGroup.findMany({ where: { schoolId, tipo: "SEC", arquivadoEm: null }, select: { name: true } })).map((g) => g.name.toLocaleLowerCase("pt-BR")),
  );
  const pessoa = (f: FuncaoMercurio) => {
    const p = porMatricula.get(f.matricula);
    return { memberId: p && p.schoolId === schoolId ? p.id : null, nome: p?.name ?? `Matrícula ${f.matricula}`, funcao: f.descricao };
  };
  // Abertura de Turma sempre aparece entre as sugestões, mesmo sem função registrada no Mercúrio (pedido do usuário 2026-10-19).
  if (!sugestoes.some((s) => s.nome === "Abertura de Turma")) sugestoes.unshift({ nome: "Abertura de Turma", responsaveis: [], equipe: [] });
  return sugestoes.map((s) => ({ nome: s.nome, jaExiste: existentes.has(s.nome.toLocaleLowerCase("pt-BR")), responsaveis: s.responsaveis.map(pessoa), equipe: s.equipe.map(pessoa) }));
}

/** Cria de uma vez as secretarias sugeridas escolhidas, com os responsáveis e a equipe do Mercúrio. */
export async function criarSecretariasSugeridas(schoolId: string, nomes: string[]) {
  return executar(async () => {
    const m = await eu();
    if (!(await administra(m, schoolId))) throw new GrupoErro("Só a administração da filial cria secretarias.");
    const sugestoes = (await getSugestoesSecretarias(schoolId)).filter((s) => nomes.includes(s.nome) && !s.jaExiste);
    let criadas = 0;
    for (const s of sugestoes) {
      const resp = [...new Set(s.responsaveis.map((r) => r.memberId).filter((x): x is string => !!x))];
      const equipe = [...new Set(s.equipe.map((r) => r.memberId).filter((x): x is string => !!x && !resp.includes(x)))];
      const g = await db.classGroup.create({ data: { schoolId, tipo: "SEC", name: s.nome, criadoPorId: m.id } });
      await db.classMembership.createMany({
        data: [...resp.map((memberId) => ({ classGroupId: g.id, memberId, role: "professor" as const })), ...equipe.map((memberId) => ({ classGroupId: g.id, memberId, role: "aluno" as const }))],
        skipDuplicates: true,
      });
      await garantirAcesso(m.id, [...resp, ...equipe]);
      criadas++;
    }
    atualizar();
    return { criadas };
  });
}

/**
 * "Quero participar" do Portal do Aluno (pedido do usuário 2026-10-25): grupo de estudo e leitura
 * comentada são abertos — a pessoa entra na hora, se o grupo aceita alguém como ela (candidatoElegivel).
 */
export async function entrarNoGrupoDeEstudo(grupoId: string) {
  return executar(async () => {
    const m = await eu();
    const g = await db.classGroup.findUnique({ where: { id: grupoId }, select: { id: true, tipo: true, schoolId: true, permiteAlunos: true, arquivadoEm: true } });
    if (!g || g.arquivadoEm || (g.tipo !== "ESTUDO" && g.tipo !== "LEITURA")) throw new GrupoErro("Este grupo não está aberto.");
    const motivo = await candidatoElegivel(g.tipo, g.schoolId, g.permiteAlunos, m.id);
    if (motivo) throw new GrupoErro(motivo);
    await db.classMembership.createMany({ data: [{ classGroupId: g.id, memberId: m.id, role: "aluno" }], skipDuplicates: true });
    atualizar(g.id);
    return {};
  });
}
