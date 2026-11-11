import "server-only";
import { escolasChefiadas } from "@/lib/acesso-voluntario";
import { areasNaFilial } from "@/lib/areas-filial";
import { db } from "@/lib/db";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
import type { Member } from "@prisma/client";
import { rotuloFormacao, type StatusSolicitacaoPedagogo } from "./solicitacoes-pedagogo-comum";

/**
 * Solicitação de inclusão de pedagogo no Mercúrio (pedido do usuário 11/11/2026: "função somente do diretor e
 * subchefe", ficando registrado quem solicitou). Sempre reconferido no servidor:
 *  - pede: Chefe da filial (inclui quem chefia outras filiais) e Sub-Chefe da própria filial, se o chefe não retirou
 *    dele a Escolástica;
 *  - atende (marca como incluída ou não incluída) e vê as solicitações de todas as filiais: o responsável nacional pelos
 *    pedagogos (Giordano Bruno, matr. 268 — pedido do usuário 11/11/2026) e quem ele indicar; o dono do sistema também
 *    entra (acesso total), mas não recebe os avisos.
 * Quando a importação do Mercúrio passa a trazer a pessoa como pedagogo, a solicitação pendente fecha sozinha.
 */
type Pessoa = Pick<
  Member,
  "id" | "schoolId" | "isDiretor" | "isSubChefe" | "isSecretarioEscolastica" | "isSecretarioEconomia" | "filiaisChefiadas" | "mercurioId" | "mercurioAtivo"
>;

/** Matrícula do responsável nacional pelos pedagogos; configurável por RESPONSAVEL_NACIONAL_PEDAGOGOS. */
export const RESPONSAVEL_NACIONAL_PEDAGOGOS = (process.env.RESPONSAVEL_NACIONAL_PEDAGOGOS ?? "268").trim();
const CHAVE_INDICADOS = "atendentes-novos-pedagogos";

/** Matrículas que o responsável nacional indicou para atender junto com ele (ResumoNacional, sem tabela nova). */
export async function indicadosParaAtender(): Promise<string[]> {
  const r = await db.resumoNacional.findUnique({ where: { chave: CHAVE_INDICADOS } });
  const lista = (r?.dados as { matriculas?: unknown } | undefined)?.matriculas;
  return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
}

export async function gravarIndicados(matriculas: string[]) {
  const dados = { matriculas: [...new Set(matriculas)] };
  await db.resumoNacional.upsert({ where: { chave: CHAVE_INDICADOS }, create: { chave: CHAVE_INDICADOS, dados }, update: { dados, geradoEm: new Date() } });
}

/**
 * nacional: atende e vê todas as filiais; gereIndicados: o responsável (e o dono do sistema) indica quem atende;
 * escolas: filiais em que a pessoa pede (Chefe/Sub-Chefe).
 */
export type AcessoNovosPedagogos = { nacional: boolean; gereIndicados: boolean; escolas: string[] };

export async function acessoNovosPedagogos(m: Pessoa): Promise<AcessoNovosPedagogos> {
  if (!m.mercurioAtivo) return { nacional: false, gereIndicados: false, escolas: [] };
  const gereIndicados = m.mercurioId === RESPONSAVEL_NACIONAL_PEDAGOGOS || ehDonoDoSistema(m);
  const nacional = gereIndicados || (!!m.mercurioId && (await indicadosParaAtender()).includes(m.mercurioId));
  const escolas = new Set(await escolasChefiadas(m));
  if (m.isSubChefe && (await areasNaFilial(m, m.schoolId)).includes("escolastica")) escolas.add(m.schoolId);
  return { nacional, gereIndicados, escolas: [...escolas] };
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

/** Quem atende (o responsável nacional e os indicados), para avisar de um pedido novo. */
export async function contasQueAtendem(): Promise<string[]> {
  const matriculas = [RESPONSAVEL_NACIONAL_PEDAGOGOS, ...(await indicadosParaAtender())];
  return (await db.member.findMany({ where: { mercurioId: { in: [...new Set(matriculas)] }, mercurioAtivo: true }, select: { id: true } })).map((m) => m.id);
}

/** Nomes do responsável e dos indicados, para a tela. */
export async function equipeQueAtende() {
  const indicados = await indicadosParaAtender();
  const pessoas = await db.member.findMany({
    where: { mercurioId: { in: [RESPONSAVEL_NACIONAL_PEDAGOGOS, ...indicados] } },
    select: { name: true, mercurioId: true, school: { select: { name: true } } },
  });
  const de = (matr: string) => {
    const p = pessoas.find((x) => x.mercurioId === matr);
    return { matricula: matr, nome: p?.name ?? `Matrícula ${matr}`, filial: p ? filialCurta(p.school.name) : "" };
  };
  return { responsavel: de(RESPONSAVEL_NACIONAL_PEDAGOGOS), indicados: indicados.map(de) };
}
