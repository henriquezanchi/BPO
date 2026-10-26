"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { BUCKET_PLANOS, EXTENSOES_PLANO, TAMANHO_MAX_PLANO, previaDaEscala } from "@/lib/escala-pedagogos";
import { papelNoGrupo } from "@/lib/grupos-portal";
import { avisarSemEsperar } from "@/lib/push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { catalogoDaMateria } from "@/lib/temas-curriculo";
import { revalidatePath } from "next/cache";

/** Escala de apresentações e planos de aula da turma de pedagogos (pedido do usuário 2026-10-26). */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const falha = (error: string) => ({ ok: false as const, error });
const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

async function gestor(grupoId: string) {
  const m = await getAuthenticatedMember();
  if (!m) return null;
  const papel = await papelNoGrupo(m, grupoId);
  return papel.tipo === "PED" && papel.podeGerir ? { m, papel } : null;
}

function atualizar(grupoId: string) {
  revalidatePath(`/grupos/${grupoId}`);
  revalidatePath("/professor");
}

/** Responsáveis (instrutor dos pedagogos) do grupo, para os avisos. */
async function instrutoresDaTurma(grupoId: string) {
  return (await db.classMembership.findMany({ where: { classGroupId: grupoId, role: "professor" }, select: { memberId: true } })).map((r) => r.memberId);
}

// ───────────────────────── Escala (instrutor dos pedagogos e gestão) ─────────────────────────

export async function preverEscala(grupoId: string, opcoes: { sigla: string; inicio: string; porEncontro: number; diaSemana?: number }) {
  if (!(await gestor(grupoId))) return falha("Sem permissão.");
  if (!catalogoDaMateria(opcoes.sigla)) return falha("Escolha a disciplina.");
  if (!dataValida(opcoes.inicio)) return falha("Escolha a data de início.");
  const p = await previaDaEscala(grupoId, opcoes);
  if (!p.linhas.length) return falha("A turma ainda não tem pedagogos. Inclua os instrutores na aba Pessoas.");
  return { ok: true as const, linhas: p.linhas };
}

export async function gravarEscala(grupoId: string, linhas: { pedagogoId: string; data: string; ordem: number; materiaSigla: string; tema: string; topicos: string[] }[]): Promise<Resultado> {
  const g = await gestor(grupoId);
  if (!g) return falha("Sem permissão.");
  if (!linhas.length || linhas.length > 200) return falha("Nada para gravar.");
  const integrantes = new Set((await db.classMembership.findMany({ where: { classGroupId: grupoId, role: "aluno" }, select: { memberId: true } })).map((r) => r.memberId));
  for (const l of linhas) {
    if (!integrantes.has(l.pedagogoId)) return falha("Há uma pessoa que não é pedagogo desta turma.");
    if (!dataValida(l.data) || !l.tema.trim()) return falha("Confira datas e temas.");
  }
  await db.apresentacaoPedagogo.createMany({
    data: linhas.map((l) => ({
      classGroupId: grupoId,
      schoolId: g.papel.schoolId,
      pedagogoId: l.pedagogoId,
      data: l.data,
      ordem: Math.max(1, Math.min(9, Math.floor(l.ordem))),
      materiaSigla: l.materiaSigla || null,
      tema: l.tema.trim().slice(0, 200),
      topicos: (l.topicos ?? []).slice(0, 10).map((t) => t.slice(0, 200)),
    })),
  });
  avisarSemEsperar([...new Set(linhas.map((l) => l.pedagogoId))], {
    titulo: "Escala de apresentações",
    corpo: "Sua apresentação na turma de pedagogos foi marcada. Veja a data, o tema e o prazo do plano de aula.",
    url: `/grupos/${grupoId}?aba=escala`,
    etiqueta: `escala-${grupoId}`,
  });
  atualizar(grupoId);
  return { ok: true };
}

export async function editarApresentacao(id: string, campos: { pedagogoId?: string; data?: string; tema?: string; materiaSigla?: string | null }): Promise<Resultado> {
  const a = await db.apresentacaoPedagogo.findUnique({ where: { id }, select: { classGroupId: true, pedagogoId: true } });
  if (!a || !(await gestor(a.classGroupId))) return falha("Sem permissão.");
  if (campos.data !== undefined && !dataValida(campos.data)) return falha("Data inválida.");
  if (campos.tema !== undefined && !campos.tema.trim()) return falha("Informe o tema.");
  if (campos.pedagogoId && !(await db.classMembership.count({ where: { classGroupId: a.classGroupId, memberId: campos.pedagogoId, role: "aluno" } }))) return falha("Escolha um pedagogo da turma.");
  await db.apresentacaoPedagogo.update({
    where: { id },
    data: {
      ...(campos.pedagogoId ? { pedagogoId: campos.pedagogoId } : {}),
      ...(campos.data ? { data: campos.data } : {}),
      ...(campos.tema !== undefined ? { tema: campos.tema.trim().slice(0, 200), topicos: catalogoDaMateria(campos.materiaSigla ?? null)?.temas.find((t) => t.titulo === campos.tema)?.topicos ?? [] } : {}),
      ...(campos.materiaSigla !== undefined ? { materiaSigla: campos.materiaSigla } : {}),
    },
  });
  // Troca de pessoa: o plano feito pela anterior não vale para a nova.
  if (campos.pedagogoId && campos.pedagogoId !== a.pedagogoId) await db.planoAula.deleteMany({ where: { apresentacaoId: id } });
  atualizar(a.classGroupId);
  return { ok: true };
}

export async function marcarApresentacao(id: string, status: "agendada" | "apresentada" | "faltou" | "cancelada"): Promise<Resultado> {
  const a = await db.apresentacaoPedagogo.findUnique({ where: { id }, select: { classGroupId: true } });
  if (!a || !(await gestor(a.classGroupId)) || !["agendada", "apresentada", "faltou", "cancelada"].includes(status)) return falha("Sem permissão.");
  await db.apresentacaoPedagogo.update({ where: { id }, data: { status } });
  atualizar(a.classGroupId);
  return { ok: true };
}

export async function removerApresentacao(id: string): Promise<Resultado> {
  const a = await db.apresentacaoPedagogo.findUnique({ where: { id }, select: { classGroupId: true, plano: { select: { arquivoPath: true } } } });
  if (!a || !(await gestor(a.classGroupId))) return falha("Sem permissão.");
  if (a.plano?.arquivoPath) await supabaseAdmin.storage.from(BUCKET_PLANOS).remove([a.plano.arquivoPath]).catch(() => {});
  await db.apresentacaoPedagogo.delete({ where: { id } });
  atualizar(a.classGroupId);
  return { ok: true };
}

/** Instrutor dos pedagogos aprova o plano ou devolve com correções. */
export async function revisarPlano(apresentacaoId: string, decisao: "aprovado" | "devolvido", comentario: string): Promise<Resultado> {
  const a = await db.apresentacaoPedagogo.findUnique({ where: { id: apresentacaoId }, select: { classGroupId: true, pedagogoId: true, tema: true, plano: { select: { status: true } } } });
  const g = a && (await gestor(a.classGroupId));
  if (!a || !g) return falha("Sem permissão.");
  if (!a.plano || a.plano.status === "rascunho") return falha("O plano ainda não foi entregue.");
  if (decisao === "devolvido" && !comentario.trim()) return falha("Escreva o que precisa ser ajustado.");
  await db.planoAula.update({
    where: { apresentacaoId },
    data: { status: decisao, comentarioInstrutor: comentario.trim().slice(0, 4000) || null, revisadoEm: new Date(), revisadoPorId: g.m.id },
  });
  avisarSemEsperar([a.pedagogoId], {
    titulo: decisao === "aprovado" ? "Plano de aula aprovado" : "Plano de aula com ajustes",
    corpo: decisao === "aprovado" ? `Seu plano "${a.tema}" foi aprovado.` : `O instrutor pediu ajustes no plano "${a.tema}". Veja os comentários.`,
    url: `/grupos/${a.classGroupId}?aba=escala`,
    etiqueta: `plano-${apresentacaoId}`,
  });
  atualizar(a.classGroupId);
  return { ok: true };
}

// ───────────────────────── Plano de aula (o pedagogo da apresentação) ─────────────────────────

async function minhaApresentacao(apresentacaoId: string) {
  const m = await getAuthenticatedMember();
  if (!m) return null;
  const a = await db.apresentacaoPedagogo.findUnique({ where: { id: apresentacaoId }, include: { plano: true } });
  return a && a.pedagogoId === m.id ? { m, a } : null;
}

const PONTOS = ["sintese", "praticaFilosofica", "ponteParaVida", "consequencias"] as const;
type Pontos = Partial<Record<(typeof PONTOS)[number], string>>;

/** Salva o rascunho ou entrega o plano (arquivo ou os 4 pontos preenchidos). */
export async function salvarPlano(apresentacaoId: string, pontos: Pontos, entregar: boolean): Promise<Resultado> {
  const r = await minhaApresentacao(apresentacaoId);
  if (!r) return falha("Este plano é de outra pessoa.");
  if (r.a.status !== "agendada") return falha("Esta apresentação não está mais em aberto.");
  const limpos = Object.fromEntries(PONTOS.map((k) => [k, (pontos[k] ?? "").trim().slice(0, 8000) || null])) as Record<(typeof PONTOS)[number], string | null>;
  const temArquivo = !!r.a.plano?.arquivoPath;
  if (entregar && !temArquivo && PONTOS.some((k) => !limpos[k])) return falha("Para entregar, envie o arquivo do plano ou preencha os 4 pontos.");
  const jaRevisado = r.a.plano?.status === "aprovado";
  const status = entregar ? "entregue" : jaRevisado ? "aprovado" : r.a.plano?.status === "devolvido" ? "devolvido" : "rascunho";
  await db.planoAula.upsert({
    where: { apresentacaoId },
    create: { apresentacaoId, autorId: r.m.id, ...limpos, status, entregueEm: entregar ? new Date() : null },
    update: { ...limpos, status, ...(entregar ? { entregueEm: new Date() } : {}) },
  });
  if (entregar)
    avisarSemEsperar(await instrutoresDaTurma(r.a.classGroupId), {
      titulo: "Plano de aula entregue",
      corpo: `${r.m.name.split(" ").slice(0, 2).join(" ")} entregou o plano "${r.a.tema}" (apresenta em ${r.a.data.split("-").reverse().join("/")}).`,
      url: `/grupos/${r.a.classGroupId}?aba=escala`,
      etiqueta: `plano-entregue-${apresentacaoId}`,
    });
  atualizar(r.a.classGroupId);
  return { ok: true };
}

/** Link assinado para o navegador enviar o arquivo direto ao armazenamento (sem passar pelo limite das ações). */
export async function linkEnvioPlano(apresentacaoId: string, nome: string, tamanho: number): Promise<Resultado<{ path: string; token: string }>> {
  const r = await minhaApresentacao(apresentacaoId);
  if (!r) return falha("Este plano é de outra pessoa.");
  const ext = (nome.split(".").pop() ?? "").toLowerCase();
  if (!EXTENSOES_PLANO.includes(ext)) return falha("Envie PDF, Word, PowerPoint ou texto.");
  if (!(tamanho > 0 && tamanho <= TAMANHO_MAX_PLANO)) return falha("O arquivo pode ter até 20 MB.");
  await supabaseAdmin.storage.createBucket(BUCKET_PLANOS, { public: false }).catch(() => {});
  const path = `${r.a.schoolId}/${r.a.classGroupId}/${apresentacaoId}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_PLANOS).createSignedUploadUrl(path);
  if (error || !data) return falha("Não foi possível preparar o envio. Tente de novo.");
  return { ok: true, path, token: data.token };
}

/** Depois do envio: guarda o arquivo no plano (e apaga o anterior). */
export async function registrarArquivoPlano(apresentacaoId: string, path: string, nome: string, tipo: string): Promise<Resultado> {
  const r = await minhaApresentacao(apresentacaoId);
  if (!r || !path.startsWith(`${r.a.schoolId}/${r.a.classGroupId}/${apresentacaoId}/`)) return falha("Envio inválido.");
  const anterior = r.a.plano?.arquivoPath;
  await db.planoAula.upsert({
    where: { apresentacaoId },
    create: { apresentacaoId, autorId: r.m.id, arquivoPath: path, arquivoNome: nome.slice(0, 200), arquivoTipo: tipo.slice(0, 120) },
    update: { arquivoPath: path, arquivoNome: nome.slice(0, 200), arquivoTipo: tipo.slice(0, 120) },
  });
  if (anterior && anterior !== path) await supabaseAdmin.storage.from(BUCKET_PLANOS).remove([anterior]).catch(() => {});
  atualizar(r.a.classGroupId);
  return { ok: true };
}

/** Link temporário (10 min) para abrir o arquivo: o próprio pedagogo e quem gere a turma. */
export async function abrirArquivoPlano(apresentacaoId: string): Promise<Resultado<{ url: string }>> {
  const m = await getAuthenticatedMember();
  if (!m) return falha("Entre no Portal.");
  const a = await db.apresentacaoPedagogo.findUnique({ where: { id: apresentacaoId }, select: { pedagogoId: true, classGroupId: true, plano: { select: { arquivoPath: true, arquivoNome: true } } } });
  if (!a?.plano?.arquivoPath) return falha("Nenhum arquivo enviado.");
  if (a.pedagogoId !== m.id && !(await gestor(a.classGroupId))) return falha("Sem permissão.");
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_PLANOS).createSignedUrl(a.plano.arquivoPath, 600, { download: a.plano.arquivoNome ?? true });
  if (error || !data) return falha("Não foi possível abrir o arquivo.");
  return { ok: true, url: data.signedUrl };
}
