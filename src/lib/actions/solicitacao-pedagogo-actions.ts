"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { avisarSemEsperar } from "@/lib/push";
import { ABERTAS, RESPONSAVEL_NACIONAL_PEDAGOGOS, acessoNovosPedagogos, contasQueAtendem, gravarIndicados, indicadosParaAtender } from "@/lib/solicitacoes-pedagogo";
import { PESSOAS_POR_PEDIDO, ehFormacao, validarMotivo } from "@/lib/solicitacoes-pedagogo-comum";
import { revalidatePath } from "next/cache";

/** Pedido de inclusão de pedagogos no Mercúrio (lib/solicitacoes-pedagogo.ts). Cada ação reconfere o acesso. */
const erro = (error: string) => ({ ok: false as const, error });
const CAMINHO = "/escolastica/novos-pedagogos";
const nomes = (lista: string[]) => (lista.length > 3 ? `${lista.slice(0, 3).join(", ")} e mais ${lista.length - 3}` : lista.join(", "));

/** Chefe/Sub-Chefe pede a inclusão de uma ou mais pessoas da filial, num pedido só, com um motivo. */
export async function solicitarPedagogos(dados: { schoolId: string; pessoas: { memberId: string; formacao: string }[]; motivo: string }) {
  const eu = await getAuthenticatedMember();
  if (!eu) return erro("Entre no Portal de novo para enviar.");
  const acesso = await acessoNovosPedagogos(eu);
  if (!acesso.escolas.includes(dados?.schoolId)) return erro("Só o Chefe e o Sub-Chefe da filial pedem a inclusão de pedagogos.");
  const lista = Array.isArray(dados.pessoas) ? dados.pessoas : [];
  if (!lista.length) return erro("Escolha ao menos uma pessoa.");
  if (lista.length > PESSOAS_POR_PEDIDO) return erro(`No máximo ${PESSOAS_POR_PEDIDO} pessoas por pedido.`);
  if (new Set(lista.map((p) => p.memberId)).size !== lista.length) return erro("A mesma pessoa aparece duas vezes.");
  if (lista.some((p) => !ehFormacao(p.formacao))) return erro("Escolha a formação de cada pessoa.");
  const motivo = validarMotivo(dados.motivo ?? "");
  if (!motivo.ok) return erro(motivo.erro);

  const pessoas = await db.member.findMany({
    where: { id: { in: lista.map((p) => p.memberId) }, schoolId: dados.schoolId, mercurioAtivo: true, mercurioId: { not: null } },
    select: { id: true, name: true, isPedagogo: true },
  });
  if (pessoas.length !== lista.length) return erro("Alguém da lista não está entre os membros ativos desta filial.");
  const jaPedagogo = pessoas.find((p) => p.isPedagogo);
  if (jaPedagogo) return erro(`${jaPedagogo.name} já aparece como pedagogo no Mercúrio.`);
  const emAberto = await db.solicitacaoPedagogo.findFirst({ where: { memberId: { in: pessoas.map((p) => p.id) }, status: { in: ABERTAS } }, select: { memberId: true } });
  if (emAberto) return erro(`Já existe um pedido aberto para ${pessoas.find((p) => p.id === emAberto.memberId)?.name}.`);

  // Mesmo instante para todas as linhas: é o que as junta num pedido (chaveDoPedido).
  const agora = new Date();
  await db.solicitacaoPedagogo.createMany({
    data: lista.map((p) => ({ schoolId: dados.schoolId, memberId: p.memberId, formacao: p.formacao, motivo: motivo.texto, solicitadoPorId: eu.id, createdAt: agora })),
  });
  const escola = await db.school.findUnique({ where: { id: dados.schoolId }, select: { name: true } });
  const filial = (escola?.name ?? "").replace(/^Nova Acrópole\s*-\s*/i, "");
  avisarSemEsperar(await contasQueAtendem(), {
    titulo: lista.length === 1 ? "Pedido de novo pedagogo" : `Pedido de ${lista.length} novos pedagogos`,
    corpo: `${filial}: ${nomes(pessoas.map((p) => p.name))}. Pedido por ${eu.name}, aguardando sua autorização.`,
    url: CAMINHO,
    etiqueta: "novos-pedagogos",
  });
  revalidatePath(CAMINHO);
  return { ok: true as const, quantos: lista.length };
}

/** Quem pode pedir na filial cancela uma pessoa enquanto ela aguarda autorização. */
export async function cancelarSolicitacaoPedagogo(id: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) return erro("Entre no Portal de novo.");
  const s = await db.solicitacaoPedagogo.findUnique({ where: { id } });
  if (!s) return erro("Pedido não encontrado.");
  if (!(await acessoNovosPedagogos(eu)).escolas.includes(s.schoolId)) return erro("Sem acesso a este pedido.");
  if (s.status !== "pendente") return erro("Esta pessoa já foi analisada.");
  await db.solicitacaoPedagogo.update({ where: { id }, data: { status: "cancelada", atendidaEm: new Date(), atendidaPorId: eu.id } });
  revalidatePath(CAMINHO);
  return { ok: true as const };
}

type Decisao = "autorizada" | "recusada" | "incluida";
const DE: Record<Decisao, string[]> = { autorizada: ["pendente"], recusada: ["pendente"], incluida: ["pendente", "autorizada"] };

/**
 * Responsável nacional (ou delegado): autoriza, não autoriza (com o motivo, que a filial lê) ou marca como incluído no
 * Mercúrio. Aceita várias pessoas de uma vez ("Autorizar todos").
 */
export async function decidirPedagogos(ids: string[], decisao: Decisao, observacao = "") {
  const eu = await getAuthenticatedMember();
  if (!eu) return erro("Entre no Portal de novo.");
  if (!(await acessoNovosPedagogos(eu)).nacional) return erro("Só o responsável nacional pelos pedagogos e quem ele delegou decidem os pedidos.");
  if (!(decisao in DE)) return erro("Decisão inválida.");
  const obs = (observacao ?? "").trim().slice(0, 1000);
  if (decisao === "recusada" && obs.length < 5) return erro("Diga à filial por que a pessoa não foi autorizada.");
  const lista = [...new Set(Array.isArray(ids) ? ids : [])].slice(0, 100);
  const regs = await db.solicitacaoPedagogo.findMany({ where: { id: { in: lista }, status: { in: DE[decisao] } } });
  if (!regs.length) return erro("Nada a decidir: as pessoas já foram analisadas.");
  const agora = new Date();
  await db.solicitacaoPedagogo.updateMany({
    where: { id: { in: regs.map((r) => r.id) }, status: { in: DE[decisao] } },
    data: { status: decisao, atendidaEm: agora, atendidaPorId: eu.id, ...(obs || decisao === "recusada" ? { observacao: obs || null } : {}) },
  });

  // Quem pediu fica sabendo da autorização ou da recusa (a inclusão em si chega pela importação do Mercúrio).
  if (decisao !== "incluida") {
    const pessoas = new Map((await db.member.findMany({ where: { id: { in: regs.map((r) => r.memberId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    for (const [autor, linhas] of Map.groupBy(regs, (r) => r.solicitadoPorId)) {
      const quem = nomes(linhas.map((l) => pessoas.get(l.memberId) ?? "pessoa"));
      avisarSemEsperar([autor], {
        titulo: decisao === "autorizada" ? "Novos pedagogos autorizados" : "Pedagogo não autorizado",
        corpo: decisao === "autorizada" ? `${quem}: autorizado pelo responsável nacional. A inclusão no Mercúrio vem em seguida.` : `${quem}: ${obs}`,
        url: CAMINHO,
        etiqueta: `novos-pedagogos-${autor}`,
      });
    }
  }
  revalidatePath(CAMINHO);
  return { ok: true as const };
}

/** Só o responsável nacional delega (ou retira) quem decide os pedidos com ele, pela matrícula. */
export async function alterarIndicadoPedagogos(matricula: string, incluir: boolean) {
  const eu = await getAuthenticatedMember();
  if (!eu) return erro("Entre no Portal de novo.");
  if (!(await acessoNovosPedagogos(eu)).gereIndicados) return erro("Só o responsável nacional pelos pedagogos delega.");
  const matr = String(matricula ?? "").replace(/\D/g, "");
  if (!matr) return erro("Informe a matrícula.");
  if (matr === RESPONSAVEL_NACIONAL_PEDAGOGOS) return erro("Você já decide os pedidos.");
  const atuais = await indicadosParaAtender();
  if (incluir) {
    const pessoa = await db.member.findFirst({ where: { mercurioId: matr, mercurioAtivo: true }, select: { name: true } });
    if (!pessoa) return erro(`Matrícula ${matr} não encontrada entre os membros ativos.`);
    if (atuais.includes(matr)) return erro(`${pessoa.name} já está na lista.`);
    await gravarIndicados([...atuais, matr]);
  } else await gravarIndicados(atuais.filter((m) => m !== matr));
  revalidatePath(CAMINHO);
  return { ok: true as const };
}
