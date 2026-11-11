import { Prisma } from "@prisma/client";
import { areasNaFilial } from "@/lib/areas-filial";
import { db } from "@/lib/db";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { agoraNoFuso } from "@/lib/lembrete-aula";
import { enviarPush } from "@/lib/push";

/**
 * Recepção do interessado novo (pedido do usuário 07/11/2026). Os interessados vêm do CRM das aberturas
 * (AberturaCrmCache), que não informa a data de inscrição; "novo" é quem aparece numa sincronização e não estava na
 * anterior. Avisos (push):
 *  - interessado novo: aos professores da abertura escolhida e a quem tem a área Escolástica, com os nomes;
 *  - no dia da primeira aula de uma abertura, às 8h da filial: quantos e quais interessados são esperados.
 * Mensagem ao próprio interessado (boas-vindas, lembrete) depende de um modelo de WhatsApp aprovado pela Meta.
 */
export type LeadCache = { id: string; nome: string; aberturaId: string | null; naoContatar: boolean };

export function leadsDoCache(dados: unknown): LeadCache[] {
  const leads = dados && typeof dados === "object" && Array.isArray((dados as { leads?: unknown }).leads) ? ((dados as { leads: unknown[] }).leads as Record<string, unknown>[]) : [];
  return leads
    .filter((l) => l && typeof l.id === "string")
    .map((l) => ({ id: String(l.id), nome: String(l.nome ?? "").trim(), aberturaId: typeof l.aberturaId === "string" && l.aberturaId ? l.aberturaId : null, naoContatar: l.naoContatar === true }));
}

/** Quem está em `depois` e não estava em `antes`. Sem cópia anterior, ninguém é novo (evita avisar a base inteira). */
export function interessadosNovos(antes: unknown, depois: unknown): LeadCache[] {
  if (!antes) return [];
  const conhecidos = new Set(leadsDoCache(antes).map((l) => l.id));
  return leadsDoCache(depois).filter((l) => !conhecidos.has(l.id) && !l.naoContatar);
}

const primeiroNome = (n: string) => n.split(/\s+/)[0]?.toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase()) ?? n;
const listaNomes = (nomes: string[], max = 5) => {
  const n = nomes.filter(Boolean).map(primeiroNome);
  return n.length > max ? `${n.slice(0, max).join(", ")} e mais ${n.length - max}` : n.length > 1 ? `${n.slice(0, -1).join(", ")} e ${n.at(-1)}` : (n[0] ?? "");
};

export function textoInteressadosNovos(nomes: string[], turma: string | null) {
  const titulo = nomes.length === 1 ? "Interessado novo" : `${nomes.length} interessados novos`;
  return { titulo: turma ? `${titulo} · ${turma}` : titulo, corpo: `${listaNomes(nomes)}. Que tal dar as boas-vindas ainda hoje?` };
}

export function textoChegadaHoje(turma: string, nomes: string[], hora: string) {
  return {
    titulo: `Hoje começa ${turma}`,
    corpo: nomes.length ? `${nomes.length === 1 ? "1 interessado esperado" : `${nomes.length} interessados esperados`} às ${hora}: ${listaNomes(nomes)}. Recebam pelo nome.` : `Primeira aula às ${hora}.`,
  };
}

/** Toque no aviso abre a lista de interessados da abertura (11/11/2026); com uma pessoa só, já filtrada pelo nome. */
export function linkInteressados(schoolId: string, aberturaId: string | null, lista: { nome: string }[]) {
  const q = new URLSearchParams({ schoolId, secao: "interessados" });
  if (aberturaId) q.set("abertura", aberturaId);
  if (lista.length === 1 && lista[0].nome) q.set("busca", lista[0].nome);
  return `/voluntario/aberturas?${q}`;
}

async function reservar(chave: string) {
  try {
    await db.pushEnviado.create({ data: { chave } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

async function equipeDaEscolastica(schoolId: string) {
  const pessoas = await db.member.findMany({ where: { schoolId, mercurioAtivo: true, pushSubscriptions: { some: {} } } });
  const ok = await Promise.all(pessoas.map(async (p) => ((await areasNaFilial(p, schoolId)).includes("escolastica") ? p.id : null)));
  return ok.filter((x): x is string => !!x);
}

/** Chamado depois de cada sincronização do CRM (aberturas/sincronizacao.ts). */
export async function avisarInteressadosNovos(schoolId: string, novos: LeadCache[]) {
  if (!novos.length) return 0;
  const escolastica = await equipeDaEscolastica(schoolId);
  const aberturas = new Map(
    (await db.aberturaTurma.findMany({ where: { schoolId, id: { in: [...new Set(novos.map((n) => n.aberturaId).filter((x): x is string => !!x))] } }, select: { id: true, titulo: true, professorIds: true } })).map((a) => [a.id, a]),
  );
  let total = 0;
  for (const [aberturaId, lista] of Map.groupBy(novos, (n) => n.aberturaId ?? "")) {
    const a = aberturas.get(aberturaId);
    const destino = [...new Set([...escolastica, ...(a?.professorIds ?? [])])];
    const ids = lista.map((l) => l.id).sort().join(",").slice(0, 120);
    if (!destino.length || !(await reservar(`interessados-novos:${schoolId}:${aberturaId}:${ids}`))) continue;
    total += (await enviarPush(destino, { ...textoInteressadosNovos(lista.map((l) => l.nome), a?.titulo ?? null), url: linkInteressados(schoolId, a?.id ?? null, lista), etiqueta: `interessados-${schoolId}` })).pessoas;
  }
  return total;
}

/** Rotina de avisos: no dia da primeira aula, às 8h da filial, professores e Escolástica sabem quem esperar. */
export async function avisosDeChegadaDeInteressados(agora = new Date()) {
  const aberturas = await db.aberturaTurma.findMany({
    where: { status: { in: ["planejada", "em_curso"] }, primeiraAula: { gte: new Date(agora.getTime() - 36 * 3600_000), lte: new Date(agora.getTime() + 36 * 3600_000) } },
    select: { id: true, schoolId: true, titulo: true, primeiraAula: true, inicioMinuto: true, professorIds: true },
  });
  const ufDe = new Map((await db.school.findMany({ where: { id: { in: [...new Set(aberturas.map((a) => a.schoolId))] } }, select: { id: true, uf: true } })).map((e) => [e.id, e.uf]));
  let total = 0;
  for (const a of aberturas) {
    const fuso = fusoDaEscola(ufDe.get(a.schoolId));
    const { hoje, minuto } = agoraNoFuso(agora, fuso);
    if (a.primeiraAula.toLocaleDateString("en-CA", { timeZone: fuso }) !== hoje || minuto < 8 * 60 || minuto >= a.inicioMinuto) continue;
    if (!(await reservar(`chegada-interessados:${a.id}:${hoje}`))) continue;
    const cache = await db.aberturaCrmCache.findUnique({ where: { schoolId: a.schoolId }, select: { dados: true } });
    const esperados = leadsDoCache(cache?.dados).filter((l) => l.aberturaId === a.id && !l.naoContatar);
    const destino = [...new Set([...(await equipeDaEscolastica(a.schoolId)), ...a.professorIds])];
    const hora = `${Math.floor(a.inicioMinuto / 60)}h${a.inicioMinuto % 60 ? String(a.inicioMinuto % 60).padStart(2, "0") : ""}`;
    total += (await enviarPush(destino, { ...textoChegadaHoje(a.titulo, esperados.map((e) => e.nome), hora), url: linkInteressados(a.schoolId, a.id, []), etiqueta: `chegada-${a.id}` })).pessoas;
  }
  return total;
}
