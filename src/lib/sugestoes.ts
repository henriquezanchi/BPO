import { db } from "@/lib/db";
import { ehAdministradorNacional, escolasQueLibera } from "@/lib/acesso-voluntario";
import type { Member, Prisma } from "@prisma/client";
import {
  CATEGORIAS_FILIAL,
  CATEGORIAS_PORTAL,
  descreverAparelho,
  ehStatus,
  semAcessoSugestoes,
  type AcessoSugestoes,
  type Aparelho,
  type Categoria,
  type StatusSugestao,
} from "./sugestoes-comum";

/**
 * Caixa de sugestões (pedido do usuário 10/11/2026). Quem lê, sempre reconferido no servidor:
 *  - categorias do Portal: administração nacional (inclui o dono do sistema);
 *  - categorias da escola: Chefe e Sub-Chefe da filial (e quem chefia outras filiais); a administração nacional vê todas.
 * Sugestão anônima: quem lê nunca recebe o nome nem a matrícula.
 */
type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "filiaisChefiadas" | "mercurioId">;

export async function acessoSugestoes(m: Pessoa): Promise<AcessoSugestoes> {
  if (await ehAdministradorNacional(m)) return { portal: true, escolas: "todas" };
  return { portal: false, escolas: await escolasQueLibera(m) };
}

export function ondeLe(a: AcessoSugestoes): Prisma.SugestaoPortalWhereInput {
  if (semAcessoSugestoes(a)) return { id: "__nenhuma__" };
  const ou: Prisma.SugestaoPortalWhereInput[] = [];
  if (a.portal) ou.push({ categoria: { in: CATEGORIAS_PORTAL } });
  ou.push(a.escolas === "todas" ? { categoria: { in: CATEGORIAS_FILIAL } } : { categoria: { in: CATEGORIAS_FILIAL }, schoolId: { in: a.escolas } });
  return { OR: ou };
}

export type SugestaoParaLer = {
  id: string;
  categoria: Categoria;
  subcategoria: string | null;
  titulo: string | null;
  contexto: string;
  texto: string;
  status: StatusSugestao;
  anonima: boolean;
  autor: { nome: string; matricula: string | null } | null;
  filial: string;
  aparelho: string;
  resposta: string | null;
  respondidaEm: string | null;
  respondidaPor: string | null;
  criadaEm: string;
};

export async function listarSugestoes(a: AcessoSugestoes): Promise<SugestaoParaLer[]> {
  const regs = await db.sugestaoPortal.findMany({ where: ondeLe(a), orderBy: { createdAt: "desc" }, take: 500 });
  if (!regs.length) return [];
  const ids = [...new Set(regs.flatMap((r) => [...(r.anonima ? [] : [r.memberId]), ...(r.respondidaPorId ? [r.respondidaPorId] : [])]))];
  const [pessoas, escolas] = await Promise.all([
    db.member.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, mercurioId: true } }),
    db.school.findMany({ where: { id: { in: [...new Set(regs.map((r) => r.schoolId))] } }, select: { id: true, name: true, city: true } }),
  ]);
  const pm = new Map(pessoas.map((p) => [p.id, p]));
  const pe = new Map(escolas.map((e) => [e.id, e.city ?? e.name]));
  return regs.map((r) => {
    const autor = r.anonima ? null : pm.get(r.memberId);
    return {
      id: r.id,
      categoria: r.categoria as Categoria,
      subcategoria: r.subcategoria,
      titulo: r.titulo,
      contexto: descreverContexto(r.contexto),
      texto: r.texto,
      status: ehStatus(r.status) ? r.status : "nova",
      anonima: r.anonima,
      autor: autor ? { nome: autor.name, matricula: autor.mercurioId } : null,
      filial: pe.get(r.schoolId) ?? "",
      aparelho: descreverAparelho(r.aparelho as Aparelho | null),
      resposta: r.resposta,
      respondidaEm: r.respondidaEm?.toISOString() ?? null,
      respondidaPor: r.respondidaPorId ? (pm.get(r.respondidaPorId)?.name ?? null) : null,
      criadaEm: r.createdAt.toISOString(),
    };
  });
}

/** Sugestões novas, para o número no menu. */
export async function sugestoesNovas(a: AcessoSugestoes): Promise<number> {
  if (semAcessoSugestoes(a)) return 0;
  return db.sugestaoPortal.count({ where: { AND: [ondeLe(a), { status: "nova" }] } });
}

/**
 * Turmas e eventos que a pessoa pode citar numa sugestão (10/11/2026): as turmas em que estuda e os eventos da filial
 * (ou nacionais) dos últimos 90 dias e dos próximos 60. É também a lista que o servidor usa para conferir o envio.
 */
export async function opcoesDeContexto(m: Pick<Member, "id" | "schoolId">) {
  const agora = Date.now();
  const [turmas, eventos] = await Promise.all([
    db.classMembership.findMany({
      where: { memberId: m.id, role: "aluno", classGroup: { arquivadoEm: null } },
      select: { classGroup: { select: { id: true, name: true } } },
    }),
    db.event.findMany({
      where: {
        OR: [{ schoolId: m.schoolId }, { scope: "nacional" }],
        status: "publicado",
        startsAt: { gte: new Date(agora - 90 * 864e5), lte: new Date(agora + 60 * 864e5) },
      },
      select: { id: true, title: true, startsAt: true, allDay: true },
      orderBy: { startsAt: "desc" },
      take: 60,
    }),
  ]);
  return {
    turmas: turmas.map((t) => ({ id: t.classGroup.id, nome: t.classGroup.name })),
    eventos: eventos.map((e) => ({
      id: e.id,
      titulo: e.title,
      data: e.startsAt.toLocaleDateString("pt-BR", { timeZone: e.allDay ? "UTC" : "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }),
    })),
  };
}
export type OpcoesDeContexto = Awaited<ReturnType<typeof opcoesDeContexto>>;
export type ContextoGuardado = { turma?: { id: string; nome: string }; evento?: { id: string; titulo: string; data: string } };

/** "Turma: N1 Terça" / "Evento: Palestra X (20/11/2026)". */
export function descreverContexto(c: unknown): string {
  const x = (c ?? {}) as ContextoGuardado;
  if (x.turma) return `Turma: ${x.turma.nome}`;
  if (x.evento) return `Evento: ${x.evento.titulo} (${x.evento.data})`;
  return "";
}

/** As sugestões que a própria pessoa enviou (inclusive as anônimas: o nome só fica escondido de quem lê). */
export async function minhasSugestoes(memberId: string) {
  const regs = await db.sugestaoPortal.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 30 });
  return regs.map((r) => ({
    id: r.id,
    categoria: r.categoria as Categoria,
    subcategoria: r.subcategoria,
    titulo: r.titulo,
    contexto: descreverContexto(r.contexto),
    texto: r.texto,
    status: (ehStatus(r.status) ? r.status : "nova") as StatusSugestao,
    anonima: r.anonima,
    resposta: r.resposta,
    respondidaEm: r.respondidaEm?.toISOString() ?? null,
    criadaEm: r.createdAt.toISOString(),
  }));
}
export type MinhaSugestao = Awaited<ReturnType<typeof minhasSugestoes>>[number];
