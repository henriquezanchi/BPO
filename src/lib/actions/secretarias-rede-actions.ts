"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  carregarContextoSecretaria,
  exigirPessoaAtiva,
  membroCabeNoTerritorio,
  podeAtribuirMandato,
  podeGerirEscalaSecretaria,
  podeGerirMandatoExistente,
  podePublicarNoTerritorio,
  podeVerPublicacao,
  validarTerritorio,
  versaoSolicitadaEstaAtual,
  type EscopoMandato,
} from "@/lib/secretarias-rede/acesso";
import { escolasDoTerritorio, chaveSecretaria, TIPOS_PUBLICACAO, type TipoPublicacao } from "@/lib/secretarias-rede/acesso";

type EstadoAcao = { ok: boolean; mensagem: string };
const falha = (mensagem: string): EstadoAcao => ({ ok: false, mensagem });
const sucesso = (mensagem: string): EstadoAcao => ({ ok: true, mensagem });
const VALORES_ESCOPO: EscopoMandato[] = ["nacional", "regional", "local"];

function texto(fd: FormData, campo: string) {
  return String(fd.get(campo) ?? "").trim();
}

function varios(fd: FormData, campo: string) {
  return fd.getAll(campo).map((value) => String(value).trim()).filter(Boolean);
}

function dataOpcional(value: string, campo: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Confira a data de ${campo}.`);
  return date;
}

function urlHttps(value: string) {
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Informe um link completo iniciado por https://.");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) throw new Error("Os links da biblioteca precisam usar HTTPS.");
  return parsed.toString();
}

function mensagemErro(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir esta ação.";
}

async function obterAtor() {
  const member = await getAuthenticatedMember();
  exigirPessoaAtiva(member);
  return member;
}

export async function salvarPublicacaoSecretaria(_prev: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const member = await obterAtor();
    const ctx = await carregarContextoSecretaria(member);
    const id = texto(formData, "publicacaoId");
    const secretaria = texto(formData, "secretaria");
    const titulo = texto(formData, "titulo");
    const tipo = texto(formData, "tipo") as TipoPublicacao;
    const conteudo = texto(formData, "conteudo");
    const territorio = await validarTerritorio(ctx.escolas, { schoolIds: varios(formData, "schoolIds"), ufs: varios(formData, "ufs") });
    const url = urlHttps(texto(formData, "url"));
    const inicio = dataOpcional(texto(formData, "inicio"), "início");
    const fim = dataOpcional(texto(formData, "fim"), "fim");
    const exigeLeitura = formData.get("exigeLeitura") === "on";

    if (!secretaria || secretaria.length > 100) throw new Error("Escolha uma secretaria válida.");
    if (!titulo || titulo.length > 180) throw new Error("O título precisa ter até 180 caracteres.");
    if (!TIPOS_PUBLICACAO.includes(tipo)) throw new Error("Escolha um tipo de publicação válido.");
    if (!conteudo || conteudo.length > 20000) throw new Error("O texto precisa ter entre 1 e 20.000 caracteres.");
    if (inicio && fim && fim < inicio) throw new Error("O fim deve ser posterior ao início.");
    if (!podePublicarNoTerritorio(ctx, secretaria, territorio)) throw new Error("Seu mandato ou responsabilidade não permite publicar para esse território.");

    if (id) {
      const anterior = await db.secretariaPublicacao.findUnique({ where: { id } });
      if (!anterior || !anterior.publicado) throw new Error("Esta publicação não está disponível para edição.");
      if (!podeVerPublicacao(ctx, anterior.secretaria, { schoolIds: anterior.schoolIds, ufs: anterior.ufs }) || !podePublicarNoTerritorio(ctx, anterior.secretaria, { schoolIds: anterior.schoolIds, ufs: anterior.ufs })) {
        throw new Error("Você não pode editar uma publicação fora do seu território.");
      }
      await db.secretariaPublicacao.update({
        where: { id },
        data: {
          secretaria,
          titulo,
          tipo,
          conteudo,
          url,
          schoolIds: territorio.schoolIds,
          ufs: territorio.ufs,
          inicio,
          fim,
          exigeLeitura,
          versao: { increment: 1 },
        },
      });
    } else {
      await db.secretariaPublicacao.create({
        data: {
          secretaria,
          autorId: member.id,
          titulo,
          tipo,
          conteudo,
          url,
          schoolIds: territorio.schoolIds,
          ufs: territorio.ufs,
          inicio,
          fim,
          exigeLeitura,
          publicado: true,
        },
      });
    }
    revalidatePath("/voluntario/secretarias");
    return sucesso(id ? "Publicação atualizada. As leituras anteriores continuam guardadas; esta versão precisa ser lida novamente." : "Publicação adicionada à biblioteca.");
  } catch (error) {
    return falha(mensagemErro(error));
  }
}

export async function confirmarLeituraSecretaria(_prev: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const member = await obterAtor();
    const id = texto(formData, "publicacaoId");
    const versao = Number(texto(formData, "versao"));
    if (!id || !Number.isInteger(versao) || versao < 1) throw new Error("Publicação inválida.");
    const [ctx, publicacao] = await Promise.all([
      carregarContextoSecretaria(member),
      db.secretariaPublicacao.findUnique({ where: { id } }),
    ]);
    if (!publicacao?.publicado || !versaoSolicitadaEstaAtual(publicacao.versao, versao) || !podeVerPublicacao(ctx, publicacao.secretaria, { schoolIds: publicacao.schoolIds, ufs: publicacao.ufs })) {
      throw new Error("Esta publicação não está disponível para sua conta.");
    }
    await db.secretariaLeitura.upsert({
      where: { publicacaoId_memberId_versao: { publicacaoId: id, memberId: member.id, versao } },
      create: { publicacaoId: id, memberId: member.id, versao },
      update: { lidoEm: new Date() },
    });
    revalidatePath("/voluntario/secretarias");
    return sucesso("Leitura confirmada.");
  } catch (error) {
    return falha(mensagemErro(error));
  }
}

export async function salvarMandatoSecretaria(_prev: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const member = await obterAtor();
    const ctx = await carregarContextoSecretaria(member);
    const secretaria = texto(formData, "secretaria");
    const escopo = texto(formData, "escopo") as EscopoMandato;
    const alvoId = texto(formData, "memberId");
    if (!secretaria || secretaria.length > 100) throw new Error("Informe a secretaria.");
    if (!VALORES_ESCOPO.includes(escopo)) throw new Error("Escolha um escopo válido.");
    if (!alvoId) throw new Error("Busque e escolha a pessoa que receberá o mandato.");
    const territorio = await validarTerritorio(ctx.escolas, { schoolIds: varios(formData, "schoolIds"), ufs: varios(formData, "ufs") }, escopo);
    if (!(await podeAtribuirMandato(ctx, secretaria, escopo, territorio))) throw new Error("Você não pode atribuir esse escopo para essa secretaria ou território.");
    const alvo = await db.member.findUnique({ where: { id: alvoId }, select: { id: true, schoolId: true, mercurioAtivo: true } });
    if (!alvo?.mercurioAtivo) throw new Error("A pessoa selecionada não está ativa.");
    if (escopo !== "nacional" && !membroCabeNoTerritorio(ctx.escolas, alvo.schoolId, territorio)) throw new Error("A pessoa selecionada não pertence ao território informado.");

    const existentes = await db.secretariaMandato.findMany({ where: { memberId: alvo.id } });
    const data = { secretaria, escopo, schoolIds: territorio.schoolIds, ufs: territorio.ufs, ativo: true };
    const anterior = existentes.find((m) =>
      chaveSecretaria(m.secretaria) === chaveSecretaria(secretaria) &&
      m.escopo === escopo &&
      JSON.stringify([...m.schoolIds].sort()) === JSON.stringify([...territorio.schoolIds].sort()) &&
      JSON.stringify([...m.ufs].sort()) === JSON.stringify([...territorio.ufs].sort()) &&
      podeGerirMandatoExistente(ctx, m),
    ) ?? null;
    if (anterior) await db.secretariaMandato.update({ where: { id: anterior.id }, data });
    else await db.secretariaMandato.create({ data: { memberId: alvo.id, ...data } });
    revalidatePath("/voluntario/secretarias");
    return sucesso(`Mandato ${escopo} salvo para a pessoa selecionada.`);
  } catch (error) {
    return falha(mensagemErro(error));
  }
}

export async function desativarMandatoSecretaria(_prev: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const member = await obterAtor();
    const ctx = await carregarContextoSecretaria(member);
    const id = texto(formData, "mandatoId");
    const mandato = await db.secretariaMandato.findUnique({ where: { id } });
    if (!mandato || !podeGerirMandatoExistente(ctx, mandato)) throw new Error("Você não pode alterar esse mandato.");
    await db.secretariaMandato.update({ where: { id }, data: { ativo: false } });
    revalidatePath("/voluntario/secretarias");
    return sucesso("Mandato desativado.");
  } catch (error) {
    return falha(mensagemErro(error));
  }
}

export type CandidatoMandato = { id: string; nome: string; matricula: string | null; escola: string; uf: string | null };

export async function buscarCandidatosMandato(input: {
  consulta: string;
  secretaria: string;
  escopo: string;
  schoolIds: string[];
  ufs: string[];
}): Promise<CandidatoMandato[]> {
  const consulta = String(input.consulta ?? "").trim();
  if (consulta.length < 2 || consulta.length > 80) return [];
  const member = await getAuthenticatedMember();
  exigirPessoaAtiva(member);
  const escopo = input.escopo as EscopoMandato;
  if (!VALORES_ESCOPO.includes(escopo)) return [];
  try {
    const ctx = await carregarContextoSecretaria(member);
    const territorio = await validarTerritorio(ctx.escolas, { schoolIds: input.schoolIds, ufs: input.ufs }, escopo);
    if (!(await podeAtribuirMandato(ctx, String(input.secretaria ?? ""), escopo, territorio))) return [];
    const escolas = escolasDoTerritorio(ctx.escolas, territorio);
    if (!escolas.length) return [];
    const candidatos = await db.member.findMany({
      where: {
        mercurioAtivo: true,
        schoolId: { in: escolas.map((escola) => escola.id) },
        OR: [
          { name: { contains: consulta, mode: "insensitive" } },
          { mercurioId: { contains: consulta, mode: "insensitive" } },
          { registrationNo: { contains: consulta, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, mercurioId: true, registrationNo: true, school: { select: { name: true, uf: true } } },
      orderBy: { name: "asc" },
      take: 15,
    });
    return candidatos.map((pessoa) => ({
      id: pessoa.id,
      nome: pessoa.name,
      matricula: pessoa.mercurioId ?? pessoa.registrationNo,
      escola: pessoa.school.name,
      uf: pessoa.school.uf,
    }));
  } catch {
    return [];
  }
}

export type CandidatoEscala = { id: string; nome: string; matricula: string | null; escola: string };

export async function buscarMembrosEscala(input: { consulta: string; secretaria: string; schoolId: string }): Promise<CandidatoEscala[]> {
  const consulta = String(input.consulta ?? "").trim();
  const secretaria = String(input.secretaria ?? "").trim();
  const schoolId = String(input.schoolId ?? "").trim();
  if (consulta.length < 2 || consulta.length > 80 || !secretaria || !schoolId) return [];
  const member = await getAuthenticatedMember();
  exigirPessoaAtiva(member);
  const ctx = await carregarContextoSecretaria(member);
  if (!podeGerirEscalaSecretaria(ctx, secretaria, schoolId)) return [];
  const candidatos = await db.member.findMany({
    where: {
      mercurioAtivo: true,
      schoolId,
      OR: [
        { name: { contains: consulta, mode: "insensitive" } },
        { mercurioId: { contains: consulta, mode: "insensitive" } },
        { registrationNo: { contains: consulta, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, mercurioId: true, registrationNo: true, school: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 15,
  });
  return candidatos.map((pessoa) => ({ id: pessoa.id, nome: pessoa.name, matricula: pessoa.mercurioId ?? pessoa.registrationNo, escola: pessoa.school.name }));
}

