"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedMember, requireArea } from "@/lib/auth";
import { db } from "@/lib/db";
import { dadosDaDeclaracao, DeclaracaoErro, nomeNoMercurio } from "@/lib/declaracoes/dados";
import { chaveEntrega, entregaDoPedido, TIPO_PEDIDO_DECLARACAO, type EntregaDeclaracao } from "@/lib/declaracoes/pedidos";
import { montarDeclaracao, SECOES, type Declaracao, type Secao } from "@/lib/declaracoes/texto";
import { avisarSemEsperar } from "@/lib/push";

/**
 * Gera o texto de uma declaração (Escolástica ou direção da filial) com os dados do Mercúrio lidos na hora. A pessoa
 * precisa ser da filial de quem pede. O texto volta para a tela, que deixa ajustar antes de imprimir; nada é guardado.
 */
const dataValida = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);

export async function gerarDeclaracao(
  schoolId: string,
  memberId: string,
  secoes: Secao[],
  finalidade: string,
  // Sem cargo, assina a direção da unidade (Mercúrio). Com cargo, assina quem está gerando (pedido do usuário 02/11/2026).
  meuCargo?: string,
  // Data em que começou a dar aula (AAAA-MM-DD), informada por quem gera: o Mercúrio não guarda esse histórico.
  instrutorDesde?: string,
  // Início no curso de formação de instrutores (AAAA-MM-DD), também informado por quem gera.
  formacaoDesde?: string,
): Promise<{ ok: true; declaracao: Declaracao } | { ok: false; error: string }> {
  const eu = await requireArea(schoolId, "escolastica");
  const [pessoa, escola] = await Promise.all([
    db.member.findFirst({ where: { id: memberId, schoolId }, select: { mercurioId: true } }),
    db.school.findUnique({ where: { id: schoolId }, select: { mercurioUnidade: true } }),
  ]);
  if (!pessoa?.mercurioId || !/^\d+$/.test(pessoa.mercurioId)) return { ok: false, error: "Pessoa sem matrícula do Mercúrio nesta filial." };
  if (!escola?.mercurioUnidade) return { ok: false, error: "Filial sem unidade do Mercúrio cadastrada." };
  const validas = SECOES.map((s) => s.id).filter((s) => secoes.includes(s));
  try {
    const dados = await dadosDaDeclaracao(pessoa.mercurioId, escola.mercurioUnidade);
    const cargo = meuCargo?.trim().slice(0, 80);
    const assinatura = cargo ? { nome: (await nomeNoMercurio(eu.mercurioId)) ?? eu.name, cargo } : undefined;
    return { ok: true, declaracao: montarDeclaracao(dados, validas, { finalidade: finalidade.slice(0, 200), assinatura, instrutorDesde: dataValida(instrutorDesde), formacaoDesde: dataValida(formacaoDesde) }) };
  } catch (e) {
    if (e instanceof DeclaracaoErro) return { ok: false, error: e.message };
    console.error("[Declaração] falha ao ler o Mercúrio:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Não foi possível ler o Mercúrio agora. Tente de novo em instantes." };
  }
}

// ───────────────────────── Declaração pedida pelo próprio aluno (06/11/2026) ─────────────────────────

export type MeuPedido = { id: string; pedidoEm: string; finalidade: string; situacao: "preparando" | "no_portal" | "retirar"; entregueEm: string | null };

/** Os pedidos de declaração da própria pessoa (os 10 mais recentes). */
export async function meusPedidosDeDeclaracao(): Promise<MeuPedido[]> {
  const eu = await getAuthenticatedMember();
  if (!eu) return [];
  const pedidos = await db.scholasticPendency.findMany({ where: { memberId: eu.id, tipo: TIPO_PEDIDO_DECLARACAO }, orderBy: { createdAt: "desc" }, take: 10 });
  return Promise.all(
    pedidos.map(async (p) => {
      const entrega = p.completedAt ? await entregaDoPedido(p.id) : null;
      return {
        id: p.id,
        pedidoEm: p.createdAt.toISOString(),
        finalidade: p.notes?.replace(/^Finalidade: /, "") ?? "",
        situacao: !p.completedAt ? "preparando" : entrega?.modo === "portal" ? "no_portal" : "retirar",
        entregueEm: entrega?.entregueEm ?? p.completedAt?.toISOString() ?? null,
      };
    }),
  );
}

/** O aluno pede a própria declaração de matrícula; vira pendência da Escolástica (um pedido aberto por vez). */
export async function pedirMinhaDeclaracao(finalidade: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false, error: "Entre no Portal de novo." };
  if (!eu.mercurioAtivo || !eu.mercurioId) return { ok: false, error: "A declaração é para alunos com matrícula ativa." };
  const aberto = await db.scholasticPendency.count({ where: { memberId: eu.id, tipo: TIPO_PEDIDO_DECLARACAO, completedAt: null } });
  if (aberto) return { ok: false, error: "Você já tem um pedido em preparo. Assim que ficar pronto, avisamos aqui e no celular." };
  const fim = finalidade.trim().slice(0, 200);
  await db.scholasticPendency.create({
    data: {
      schoolId: eu.schoolId,
      memberId: eu.id,
      tipo: TIPO_PEDIDO_DECLARACAO,
      title: `Declaração de matrícula pedida por ${eu.name}`,
      notes: fim ? `Finalidade: ${fim}` : null,
      // Prazo de referência para a secretaria: 3 dias.
      dueDate: new Date(Date.now() + 3 * 86_400_000),
    },
  });
  revalidatePath("/escolastica");
  return { ok: true };
}

/**
 * A Escolástica entrega o pedido: "portal" guarda o texto final (já ajustado na folha) para o aluno abrir e imprimir;
 * "retirar" avisa que a declaração assinada está na secretaria. Conclui a pendência e avisa o aluno no celular.
 */
export async function entregarDeclaracao(schoolId: string, pedidoId: string, modo: "portal" | "retirar", declaracao?: Declaracao): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireArea(schoolId, "escolastica");
  const pedido = await db.scholasticPendency.findFirst({ where: { id: pedidoId, schoolId, tipo: TIPO_PEDIDO_DECLARACAO, completedAt: null } });
  if (!pedido?.memberId) return { ok: false, error: "Pedido não encontrado ou já entregue." };
  if (modo === "portal" && !declaracao?.paragrafos?.length) return { ok: false, error: "Gere a declaração antes de entregar." };
  const agora = new Date();
  const entrega: EntregaDeclaracao =
    modo === "portal"
      ? {
          modo,
          entregueEm: agora.toISOString(),
          declaracao: {
            titulo: String(declaracao!.titulo).slice(0, 100),
            paragrafos: declaracao!.paragrafos.map((p) => String(p).slice(0, 3000)).slice(0, 20),
            localData: String(declaracao!.localData).slice(0, 200),
            assinatura: declaracao!.assinatura ? { nome: String(declaracao!.assinatura.nome).slice(0, 120), cargo: String(declaracao!.assinatura.cargo).slice(0, 80) } : null,
          },
        }
      : { modo, entregueEm: agora.toISOString() };
  await db.$transaction([
    db.resumoNacional.upsert({ where: { chave: chaveEntrega(pedidoId) }, update: { dados: entrega, geradoEm: agora }, create: { chave: chaveEntrega(pedidoId), dados: entrega } }),
    db.scholasticPendency.update({ where: { id: pedidoId }, data: { completedAt: agora } }),
  ]);
  await avisarSemEsperar([pedido.memberId], {
    titulo: "Sua declaração está pronta",
    corpo: modo === "portal" ? "Abra no Portal para imprimir ou salvar em PDF." : "Ela está assinada e pode ser retirada na secretaria da escola.",
    url: modo === "portal" ? `/portal/declaracao/${pedidoId}` : "/portal",
    etiqueta: `declaracao-${pedidoId}`,
  });
  revalidatePath("/escolastica");
  return { ok: true };
}
