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
 *  - autoriza (ou não) e marca a inclusão no Mercúrio: o responsável nacional pelos pedagogos (Giordano Bruno, matr. 268 —
 *    pedido do usuário 11/11/2026) e quem ELE delegar (só ele delega; a delegação não aparece para quem pede). O dono do
 *    sistema vê tudo, sem autorizar nem receber avisos.
 * Um pedido pode ter várias pessoas (uma linha por pessoa, com o mesmo autor e o mesmo instante — ver chaveDoPedido).
 * Situação de cada pessoa: pendente (aguardando autorização) → autorizada → incluida; ou recusada / cancelada.
 * Quando a importação do Mercúrio passa a trazer a pessoa como pedagogo, a linha aberta vira "incluida" sozinha.
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
 * nacional: autoriza e marca a inclusão (responsável e delegados); veTodas: vê os pedidos de todas as filiais (inclui o
 * dono do sistema); gereIndicados: só o responsável nacional delega; escolas: filiais em que a pessoa pede.
 */
export type AcessoNovosPedagogos = { nacional: boolean; veTodas: boolean; gereIndicados: boolean; escolas: string[] };

export async function acessoNovosPedagogos(m: Pessoa): Promise<AcessoNovosPedagogos> {
  if (!m.mercurioAtivo) return { nacional: false, veTodas: false, gereIndicados: false, escolas: [] };
  const gereIndicados = m.mercurioId === RESPONSAVEL_NACIONAL_PEDAGOGOS;
  const nacional = gereIndicados || (!!m.mercurioId && (await indicadosParaAtender()).includes(m.mercurioId));
  const escolas = new Set(await escolasChefiadas(m));
  if (m.isSubChefe && (await areasNaFilial(m, m.schoolId)).includes("escolastica")) escolas.add(m.schoolId);
  return { nacional, veTodas: nacional || ehDonoDoSistema(m), gereIndicados, escolas: [...escolas] };
}

export const temAcessoNovosPedagogos = (a: AcessoNovosPedagogos) => a.veTodas || a.escolas.length > 0;

export const ABERTAS = ["pendente", "autorizada"];

/** Linhas do mesmo pedido: mesmo autor, mesmo instante. */
export const chaveDoPedido = (r: { solicitadoPorId: string; createdAt: Date }) => `${r.solicitadoPorId}|${r.createdAt.toISOString()}`;

/** Fecha as abertas de quem a importação do Mercúrio já trouxe como pedagogo. */
export async function fecharJaIncluidas(escolas: string[]) {
  const pendentes = await db.solicitacaoPedagogo.findMany({ where: { status: { in: ABERTAS }, schoolId: { in: escolas } }, select: { id: true, memberId: true } });
  if (!pendentes.length) return;
  const jaSao = await db.member.findMany({ where: { id: { in: pendentes.map((p) => p.memberId) }, isPedagogo: true }, select: { id: true, pedagogoSyncedAt: true } });
  for (const p of jaSao)
    await db.solicitacaoPedagogo.updateMany({
      where: { status: { in: ABERTAS }, memberId: p.id },
      data: { status: "incluida", atendidaEm: p.pedagogoSyncedAt ?? new Date(), atendidaPorId: null },
    });
}

export type ItemDoPedido = {
  id: string;
  pessoa: { nome: string; matricula: string | null };
  formacao: string;
  status: StatusSolicitacaoPedagogo;
  observacao: string | null;
  atendidaEm: string | null;
  /** Nome de quem autorizou/recusou/marcou; null com status "incluida" = pela importação do Mercúrio. */
  atendidaPor: string | null;
};

export type PedidoParaVer = {
  chave: string;
  schoolId: string;
  filial: string;
  motivo: string;
  solicitadoPor: { id: string; nome: string; matricula: string | null };
  criadoEm: string;
  aberto: boolean;
  itens: ItemDoPedido[];
};

const filialCurta = (nome: string) => nome.replace(/^Nova Acrópole\s*-\s*/i, "");

/** Pedidos das filiais dadas: os em aberto primeiro (mais antigos no topo), depois o histórico recente. */
export async function listarPedidosPedagogo(escolas: string[]): Promise<PedidoParaVer[]> {
  if (!escolas.length) return [];
  await fecharJaIncluidas(escolas);
  const [abertas, recentes] = await Promise.all([
    db.solicitacaoPedagogo.findMany({ where: { schoolId: { in: escolas }, status: { in: ABERTAS } }, select: { createdAt: true } }),
    db.solicitacaoPedagogo.findMany({ where: { schoolId: { in: escolas } }, orderBy: { createdAt: "desc" }, take: 120, select: { createdAt: true } }),
  ]);
  const instantes = [...new Set([...abertas, ...recentes].map((r) => r.createdAt.getTime()))].map((t) => new Date(t));
  const regs = instantes.length ? await db.solicitacaoPedagogo.findMany({ where: { schoolId: { in: escolas }, createdAt: { in: instantes } }, orderBy: { createdAt: "asc" } }) : [];
  if (!regs.length) return [];
  const ids = [...new Set(regs.flatMap((r) => [r.memberId, r.solicitadoPorId, ...(r.atendidaPorId ? [r.atendidaPorId] : [])]))];
  const [pessoas, filiais] = await Promise.all([
    db.member.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, mercurioId: true } }),
    db.school.findMany({ where: { id: { in: [...new Set(regs.map((r) => r.schoolId))] } }, select: { id: true, name: true } }),
  ]);
  const pessoa = new Map(pessoas.map((p) => [p.id, p]));
  const filial = new Map(filiais.map((f) => [f.id, filialCurta(f.name)]));
  const quem = (id: string) => ({ id, nome: pessoa.get(id)?.name ?? "Pessoa removida", matricula: pessoa.get(id)?.mercurioId ?? null });

  const pedidos = new Map<string, PedidoParaVer>();
  for (const r of regs) {
    const chave = chaveDoPedido(r);
    let p = pedidos.get(chave);
    if (!p) {
      p = { chave, schoolId: r.schoolId, filial: filial.get(r.schoolId) ?? "", motivo: r.motivo, solicitadoPor: quem(r.solicitadoPorId), criadoEm: r.createdAt.toISOString(), aberto: false, itens: [] };
      pedidos.set(chave, p);
    }
    p.itens.push({
      id: r.id,
      pessoa: quem(r.memberId),
      formacao: rotuloFormacao(r.formacao),
      status: r.status as StatusSolicitacaoPedagogo,
      observacao: r.observacao,
      atendidaEm: r.atendidaEm?.toISOString() ?? null,
      atendidaPor: r.atendidaPorId ? quem(r.atendidaPorId).nome : null,
    });
    if (ABERTAS.includes(r.status)) p.aberto = true;
  }
  const lista = [...pedidos.values()];
  for (const p of lista) p.itens.sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome, "pt-BR"));
  return [...lista.filter((p) => p.aberto), ...lista.filter((p) => !p.aberto).reverse()];
}

/** Pessoas da filial que podem ser indicadas: ativas no Mercúrio, com matrícula, ainda não pedagogos e sem pedido aberto. */
export async function candidatosAPedagogo(schoolId: string) {
  const abertas = (await db.solicitacaoPedagogo.findMany({ where: { schoolId, status: { in: ABERTAS } }, select: { memberId: true } })).map((s) => s.memberId);
  return db.member.findMany({
    where: { schoolId, mercurioAtivo: true, mercurioId: { not: null }, isPedagogo: false, id: { notIn: abertas } },
    select: { id: true, name: true, mercurioId: true },
    orderBy: { name: "asc" },
  });
}

/** Quem autoriza (o responsável nacional e os delegados), para avisar de um pedido novo. */
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
