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

/** As sugestões que a própria pessoa enviou (inclusive as anônimas: o nome só fica escondido de quem lê). */
export async function minhasSugestoes(memberId: string) {
  const regs = await db.sugestaoPortal.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 30 });
  return regs.map((r) => ({
    id: r.id,
    categoria: r.categoria as Categoria,
    texto: r.texto,
    status: (ehStatus(r.status) ? r.status : "nova") as StatusSugestao,
    anonima: r.anonima,
    resposta: r.resposta,
    respondidaEm: r.respondidaEm?.toISOString() ?? null,
    criadaEm: r.createdAt.toISOString(),
  }));
}
export type MinhaSugestao = Awaited<ReturnType<typeof minhasSugestoes>>[number];
