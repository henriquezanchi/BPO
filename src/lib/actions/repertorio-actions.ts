"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { papelNoGrupo } from "@/lib/grupos-portal";
import { nomeExibicao } from "@/lib/nome-exibicao";
import { REQUISITOS_REPERTORIO, TIPOS_REPERTORIO } from "@/lib/repertorio";
import { revalidatePath } from "next/cache";

/**
 * Repertório da Secretaria de Artes (pedido do usuário 24/11/2026): quem apresentou o quê (música, poesia, teatro,
 * dança…), guardado como repertório da filial para sugerir quando houver eventos programados. Quem gere a secretaria
 * ou integra o grupo registra; a direção vê as sugestões no cadastro de eventos.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function acesso(grupoId: string) {
  const m = await getAuthenticatedMember();
  if (!m) return null;
  const papel = await papelNoGrupo(m, grupoId);
  if (!papel.podeVer) return null;
  return { m, papel };
}

export type ItemRepertorio = {
  id: string;
  artistaId: string | null;
  artistaNome: string;
  titulo: string;
  tipo: string;
  duracaoMin: number | null;
  observacoes: string | null;
  requisitos: string[];
  requisitosOutros: string | null;
  formatoSimplificado: string | null;
  apresentadoEm: string | null;
  evento: string | null;
};

export async function listarRepertorio(grupoId: string): Promise<Resultado<{ itens: ItemRepertorio[] }>> {
  const a = await acesso(grupoId);
  if (!a) return { ok: false, error: "Sem acesso a este grupo." };
  const itens = await db.repertorioArtistico.findMany({
    where: { classGroupId: grupoId },
    orderBy: [{ artistaNome: "asc" }, { apresentadoEm: "desc" }],
    select: { id: true, artistaId: true, artistaNome: true, titulo: true, tipo: true, duracaoMin: true, observacoes: true, requisitos: true, requisitosOutros: true, formatoSimplificado: true, apresentadoEm: true, evento: true },
  });
  return { ok: true, itens };
}

/** Artistas: pessoas ativas da filial (busca por nome), para ligar a apresentação ao voluntário. */
export async function buscarArtistas(grupoId: string, termo: string) {
  const a = await acesso(grupoId);
  if (!a) return [];
  const t = termo.trim();
  if (t.length < 2) return [];
  const pessoas = await db.member.findMany({
    where: { schoolId: a.papel.schoolId, mercurioAtivo: true, name: { contains: t, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true, apelido: true },
  });
  return pessoas.map((p) => ({ id: p.id, name: `${nomeExibicao(p)} (${p.name})` }));
}

export async function salvarRepertorio(
  grupoId: string,
  d: { id?: string; artistaId?: string | null; artistaNome: string; titulo: string; tipo: string; duracaoMin?: number | null; observacoes?: string; requisitos?: string[]; requisitosOutros?: string; formatoSimplificado?: string; apresentadoEm?: string; evento?: string },
): Promise<Resultado> {
  const a = await acesso(grupoId);
  if (!a || !(a.papel.podeGerir || a.papel.integrante)) return { ok: false, error: "Só a Secretaria de Artes registra o repertório." };
  const artistaNome = d.artistaNome.replace(/\s+/g, " ").trim().slice(0, 120);
  const titulo = d.titulo.replace(/\s+/g, " ").trim().slice(0, 160);
  if (artistaNome.length < 2) return { ok: false, error: "Informe quem apresenta." };
  if (titulo.length < 2) return { ok: false, error: "Informe o que foi (ou será) apresentado." };
  if (!TIPOS_REPERTORIO.some(([t]) => t === d.tipo)) return { ok: false, error: "Escolha o tipo." };
  if (d.apresentadoEm && !/^\d{4}-\d{2}-\d{2}$/.test(d.apresentadoEm)) return { ok: false, error: "Data inválida." };
  if (d.artistaId && !(await db.member.count({ where: { id: d.artistaId, schoolId: a.papel.schoolId } }))) return { ok: false, error: "Artista fora da filial." };
  const dados = {
    artistaId: d.artistaId || null,
    artistaNome,
    titulo,
    tipo: d.tipo,
    duracaoMin: d.duracaoMin && d.duracaoMin > 0 ? Math.min(600, Math.floor(d.duracaoMin)) : null,
    observacoes: d.observacoes?.trim().slice(0, 1000) || null,
    // O que a apresentação precisa (24/11/2026): microfone, pedestal, som, luzes…; e um formato simplificado, se houver.
    requisitos: (d.requisitos ?? []).filter((r) => REQUISITOS_REPERTORIO.some(([k]) => k === r)).slice(0, 20),
    requisitosOutros: d.requisitosOutros?.trim().slice(0, 300) || null,
    formatoSimplificado: d.formatoSimplificado?.trim().slice(0, 500) || null,
    apresentadoEm: d.apresentadoEm || null,
    evento: d.evento?.trim().slice(0, 160) || null,
  };
  if (d.id) {
    const r = await db.repertorioArtistico.updateMany({ where: { id: d.id, classGroupId: grupoId }, data: dados });
    if (!r.count) return { ok: false, error: "Registro não encontrado." };
  } else {
    await db.repertorioArtistico.create({ data: { ...dados, schoolId: a.papel.schoolId, classGroupId: grupoId, criadoPorId: a.m.id } });
  }
  revalidatePath(`/grupos/${grupoId}`);
  return { ok: true };
}

export async function removerRepertorio(grupoId: string, id: string): Promise<Resultado> {
  const a = await acesso(grupoId);
  if (!a || !(a.papel.podeGerir || a.papel.integrante)) return { ok: false, error: "Sem permissão." };
  await db.repertorioArtistico.deleteMany({ where: { id, classGroupId: grupoId } });
  revalidatePath(`/grupos/${grupoId}`);
  return { ok: true };
}

/**
 * Sugestões para um evento (direção, no cadastro de eventos): o repertório da filial agrupado por artista, com a
 * última apresentação, para a equipe chamar quem já tem número pronto.
 */
export async function sugestoesDoRepertorio(schoolId: string) {
  const m = await getAuthenticatedMember();
  if (!m || m.schoolId !== schoolId) return [];
  const itens = await db.repertorioArtistico.findMany({
    where: { schoolId },
    orderBy: [{ apresentadoEm: "desc" }],
    select: { artistaId: true, artistaNome: true, titulo: true, tipo: true, duracaoMin: true, requisitos: true, requisitosOutros: true, formatoSimplificado: true, apresentadoEm: true, evento: true },
    take: 200,
  });
  const porArtista = new Map<string, { artista: string; numeros: { titulo: string; tipo: string; duracaoMin: number | null; requisitos: string[]; requisitosOutros: string | null; formatoSimplificado: string | null; apresentadoEm: string | null; evento: string | null }[] }>();
  for (const i of itens) {
    const k = i.artistaId ?? i.artistaNome;
    const a = porArtista.get(k) ?? { artista: i.artistaNome, numeros: [] };
    a.numeros.push({ titulo: i.titulo, tipo: i.tipo, duracaoMin: i.duracaoMin, requisitos: i.requisitos, requisitosOutros: i.requisitosOutros, formatoSimplificado: i.formatoSimplificado, apresentadoEm: i.apresentadoEm, evento: i.evento });
    porArtista.set(k, a);
  }
  return [...porArtista.values()].sort((a, b) => a.artista.localeCompare(b.artista, "pt-BR"));
}
