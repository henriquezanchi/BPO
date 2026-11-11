import "server-only";
import { ehAdministradorNacional, escolasChefiadas } from "@/lib/acesso-voluntario";
import { areasNaFilial } from "@/lib/areas-filial";
import { db } from "@/lib/db";
import { donosDoSistema } from "@/lib/dono-do-sistema";
import type { Member } from "@prisma/client";
import { rotuloFormacao, type StatusSolicitacaoPedagogo } from "./solicitacoes-pedagogo-comum";

/**
 * Solicitação de inclusão de pedagogo no Mercúrio (pedido do usuário 11/11/2026: "função somente do diretor e
 * subchefe", ficando registrado quem solicitou). Sempre reconferido no servidor:
 *  - pede: Chefe da filial (inclui quem chefia outras filiais) e Sub-Chefe da própria filial, se o chefe não retirou
 *    dele a Escolástica;
 *  - atende (marca como incluída ou não incluída): administração nacional, que vê as solicitações de todas as filiais.
 * Quando a importação do Mercúrio passa a trazer a pessoa como pedagogo, a solicitação pendente fecha sozinha.
 */
type Pessoa = Pick<
  Member,
  "id" | "schoolId" | "isDiretor" | "isSubChefe" | "isSecretarioEscolastica" | "isSecretarioEconomia" | "filiaisChefiadas" | "mercurioId" | "mercurioAtivo"
>;

export type AcessoNovosPedagogos = { nacional: boolean; escolas: string[] };

export async function acessoNovosPedagogos(m: Pessoa): Promise<AcessoNovosPedagogos> {
  if (!m.mercurioAtivo) return { nacional: false, escolas: [] };
  const nacional = await ehAdministradorNacional(m);
  const escolas = new Set(await escolasChefiadas(m));
  if (m.isSubChefe && (await areasNaFilial(m, m.schoolId)).includes("escolastica")) escolas.add(m.schoolId);
  return { nacional, escolas: [...escolas] };
}

export const temAcessoNovosPedagogos = (a: AcessoNovosPedagogos) => a.nacional || a.escolas.length > 0;

/** Fecha as pendentes de quem a importação do Mercúrio já trouxe como pedagogo. */
export async function fecharJaIncluidas(escolas: string[]) {
  const pendentes = await db.solicitacaoPedagogo.findMany({ where: { status: "pendente", schoolId: { in: escolas } }, select: { id: true, memberId: true } });
  if (!pendentes.length) return;
  const jaSao = await db.member.findMany({ where: { id: { in: pendentes.map((p) => p.memberId) }, isPedagogo: true }, select: { id: true, pedagogoSyncedAt: true } });
  for (const p of jaSao)
    await db.solicitacaoPedagogo.updateMany({
      where: { status: "pendente", memberId: p.id },
      data: { status: "incluida", atendidaEm: p.pedagogoSyncedAt ?? new Date(), observacao: "A pessoa passou a aparecer como pedagogo na importação do Mercúrio." },
    });
}

export type SolicitacaoParaVer = {
  id: string;
  schoolId: string;
  filial: string;
  pessoa: { nome: string; matricula: string | null };
  formacao: string;
  motivo: string;
  status: StatusSolicitacaoPedagogo;
  solicitadoPor: { id: string; nome: string; matricula: string | null };
  criadaEm: string;
  observacao: string | null;
  atendidaEm: string | null;
  atendidaPor: string | null;
};

const filialCurta = (nome: string) => nome.replace(/^Nova Acrópole\s*-\s*/i, "");

/** Solicitações das filiais dadas, pendentes primeiro (as mais antigas no topo) e depois o histórico recente. */
export async function listarSolicitacoesPedagogo(escolas: string[]): Promise<SolicitacaoParaVer[]> {
  if (!escolas.length) return [];
  await fecharJaIncluidas(escolas);
  const [pendentes, historico] = await Promise.all([
    db.solicitacaoPedagogo.findMany({ where: { schoolId: { in: escolas }, status: "pendente" }, orderBy: { createdAt: "asc" } }),
    db.solicitacaoPedagogo.findMany({ where: { schoolId: { in: escolas }, status: { not: "pendente" } }, orderBy: { updatedAt: "desc" }, take: 60 }),
  ]);
  const regs = [...pendentes, ...historico];
  if (!regs.length) return [];
  const ids = [...new Set(regs.flatMap((r) => [r.memberId, r.solicitadoPorId, ...(r.atendidaPorId ? [r.atendidaPorId] : [])]))];
  const [pessoas, filiais] = await Promise.all([
    db.member.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, mercurioId: true } }),
    db.school.findMany({ where: { id: { in: [...new Set(regs.map((r) => r.schoolId))] } }, select: { id: true, name: true } }),
  ]);
  const pessoa = new Map(pessoas.map((p) => [p.id, p]));
  const filial = new Map(filiais.map((f) => [f.id, filialCurta(f.name)]));
  const quem = (id: string) => ({ id, nome: pessoa.get(id)?.name ?? "Pessoa removida", matricula: pessoa.get(id)?.mercurioId ?? null });
  return regs.map((r) => ({
    id: r.id,
    schoolId: r.schoolId,
    filial: filial.get(r.schoolId) ?? "",
    pessoa: quem(r.memberId),
    formacao: rotuloFormacao(r.formacao),
    motivo: r.motivo,
    status: r.status as StatusSolicitacaoPedagogo,
    solicitadoPor: quem(r.solicitadoPorId),
    criadaEm: r.createdAt.toISOString(),
    observacao: r.observacao,
    atendidaEm: r.atendidaEm?.toISOString() ?? null,
    atendidaPor: r.atendidaPorId ? quem(r.atendidaPorId).nome : null,
  }));
}

/** Pessoas da filial que podem ser indicadas: ativas no Mercúrio, com matrícula, ainda não pedagogos e sem pedido aberto. */
export async function candidatosAPedagogo(schoolId: string) {
  const abertas = (await db.solicitacaoPedagogo.findMany({ where: { schoolId, status: "pendente" }, select: { memberId: true } })).map((s) => s.memberId);
  return db.member.findMany({
    where: { schoolId, mercurioAtivo: true, mercurioId: { not: null }, isPedagogo: false, id: { notIn: abertas } },
    select: { id: true, name: true, mercurioId: true },
    orderBy: { name: "asc" },
  });
}

/** Contas da administração nacional (dono do sistema e liberadores nacionais), para avisar de um pedido novo. */
export async function contasDaAdministracaoNacional(): Promise<string[]> {
  const matriculas = [...donosDoSistema(), ...(await db.liberadorNacional.findMany({ select: { mercurioId: true } })).map((l) => l.mercurioId)];
  return (await db.member.findMany({ where: { mercurioId: { in: [...new Set(matriculas)] } }, select: { id: true } })).map((m) => m.id);
}
