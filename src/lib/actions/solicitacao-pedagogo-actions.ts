"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { avisarSemEsperar } from "@/lib/push";
import { acessoNovosPedagogos, contasDaAdministracaoNacional } from "@/lib/solicitacoes-pedagogo";
import { ehFormacao, rotuloFormacao, validarMotivo } from "@/lib/solicitacoes-pedagogo-comum";
import { revalidatePath } from "next/cache";

/** Solicitação de inclusão de pedagogo no Mercúrio (lib/solicitacoes-pedagogo.ts). Cada ação reconfere o acesso. */
const erro = (error: string) => ({ ok: false as const, error });
const CAMINHO = "/escolastica/novos-pedagogos";

export async function solicitarPedagogo(dados: { schoolId: string; memberId: string; formacao: string; motivo: string }) {
  const eu = await getAuthenticatedMember();
  if (!eu) return erro("Entre no Portal de novo para enviar.");
  const acesso = await acessoNovosPedagogos(eu);
  if (!acesso.escolas.includes(dados?.schoolId)) return erro("Só o Chefe e o Sub-Chefe da filial pedem a inclusão de pedagogos.");
  if (!ehFormacao(dados.formacao)) return erro("Escolha a formação.");
  const motivo = validarMotivo(dados.motivo ?? "");
  if (!motivo.ok) return erro(motivo.erro);

  const pessoa = await db.member.findFirst({
    where: { id: dados.memberId, schoolId: dados.schoolId, mercurioAtivo: true, mercurioId: { not: null } },
    select: { id: true, name: true, isPedagogo: true, school: { select: { name: true } } },
  });
  if (!pessoa) return erro("Pessoa não encontrada entre os membros ativos desta filial.");
  if (pessoa.isPedagogo) return erro(`${pessoa.name} já aparece como pedagogo no Mercúrio.`);
  if (await db.solicitacaoPedagogo.count({ where: { memberId: pessoa.id, status: "pendente" } })) return erro(`Já existe um pedido aberto para ${pessoa.name}.`);

  await db.solicitacaoPedagogo.create({
    data: { schoolId: dados.schoolId, memberId: pessoa.id, formacao: dados.formacao, motivo: motivo.texto, solicitadoPorId: eu.id },
  });
  const filial = pessoa.school.name.replace(/^Nova Acrópole\s*-\s*/i, "");
  avisarSemEsperar(await contasDaAdministracaoNacional(), {
    titulo: "Novo pedagogo para incluir no Mercúrio",
    corpo: `${filial}: ${pessoa.name} (${rotuloFormacao(dados.formacao).toLowerCase()}), pedido por ${eu.name}.`,
    url: CAMINHO,
    etiqueta: "novos-pedagogos",
  });
  revalidatePath(CAMINHO);
  return { ok: true as const };
}

/** Quem pediu (ou outro Chefe/Sub-Chefe da mesma filial) cancela enquanto está aguardando. */
export async function cancelarSolicitacaoPedagogo(id: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) return erro("Entre no Portal de novo.");
  const s = await db.solicitacaoPedagogo.findUnique({ where: { id } });
  if (!s) return erro("Pedido não encontrado.");
  const acesso = await acessoNovosPedagogos(eu);
  if (!acesso.escolas.includes(s.schoolId)) return erro("Sem acesso a este pedido.");
  if (s.status !== "pendente") return erro("Este pedido já foi atendido.");
  await db.solicitacaoPedagogo.update({ where: { id }, data: { status: "cancelada", atendidaEm: new Date(), atendidaPorId: eu.id } });
  revalidatePath(CAMINHO);
  return { ok: true as const };
}

/** Administração nacional: marca como incluída no Mercúrio ou como não incluída (com o motivo, que a filial lê). */
export async function atenderSolicitacaoPedagogo(id: string, resultado: "incluida" | "recusada", observacao: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) return erro("Entre no Portal de novo.");
  if (!(await acessoNovosPedagogos(eu)).nacional) return erro("Só a administração nacional marca a inclusão no Mercúrio.");
  if (resultado !== "incluida" && resultado !== "recusada") return erro("Resultado inválido.");
  const obs = (observacao ?? "").trim().slice(0, 1000);
  if (resultado === "recusada" && obs.length < 5) return erro("Diga à filial por que a pessoa não foi incluída.");
  const s = await db.solicitacaoPedagogo.findUnique({ where: { id } });
  if (!s) return erro("Pedido não encontrado.");
  if (s.status !== "pendente") return erro("Este pedido já foi atendido.");
  await db.solicitacaoPedagogo.update({ where: { id }, data: { status: resultado, observacao: obs || null, atendidaEm: new Date(), atendidaPorId: eu.id } });
  const pessoa = await db.member.findUnique({ where: { id: s.memberId }, select: { name: true } });
  avisarSemEsperar([s.solicitadoPorId], {
    titulo: resultado === "incluida" ? "Pedagogo incluído no Mercúrio" : "Pedagogo não incluído",
    corpo: resultado === "incluida" ? `A inclusão de ${pessoa?.name ?? "quem você indicou"} como pedagogo foi feita no Mercúrio.` : `${pessoa?.name ?? "A pessoa"}: ${obs}`,
    url: CAMINHO,
    etiqueta: `novo-pedagogo-${id}`,
  });
  revalidatePath(CAMINHO);
  return { ok: true as const };
}
