import { db } from "@/lib/db";

/**
 * Problemas de pagamento da filial (pedido do usuário 12/11/2026): o que os voluntários da Economia conseguem resolver
 * fica com eles; o que é de sistema fica com o dono do sistema. Mostrado em Economia → Cobrança on-line.
 */
export type Pessoa = { nome: string; matricula: string | null; detalhe: string; tarefaId?: string };
export type Problema = { id: string; titulo: string; oQueFazer: string; pessoas: Pessoa[] };

const PENDENTE_HA_DIAS = 3;
const curto = (s: string | null | undefined, n = 180) => {
  const t = (s ?? "").split("\n")[0].trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Erros do lançamento no Mercúrio que pedem conferência ou lançamento à mão (mensagens do playwright-adapter). */
const ERRO_DO_VOLUNTARIO = /manualmente|ficha PENDENTE|fechado\/travado|ficha pendente mais antiga|Caixa ".*" não encontrado|confer[eê]ncia humana/i;

export async function problemasDePagamento(schoolId: string): Promise<{ voluntario: Problema[]; sistema: Problema[] }> {
  const limite = new Date(Date.now() - PENDENTE_HA_DIAS * 864e5);
  const [lancamentos, pendentes, debitos, semComposicao] = await Promise.all([
    db.mercurioSyncTask.findMany({
      where: { taskType: "lancar_contribuicao_paga", status: "falhou", member: { schoolId } },
      select: { id: true, lastError: true, createdAt: true, member: { select: { name: true, mercurioId: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.paymentCharge.findMany({
      where: { status: "pendente", autoDebito: false, createdAt: { lt: limite }, member: { schoolId, mercurioAtivo: true } },
      select: { referenceMonth: true, referenceYear: true, createdAt: true, billingType: true, member: { select: { name: true, mercurioId: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.member.findMany({
      where: { schoolId, mercurioAtivo: true, pixAutomaticStatus: { in: ["REFUSED", "EXPIRED", "CANCELLED"] } },
      select: { name: true, mercurioId: true, pixAutomaticStatus: true },
      orderBy: { name: "asc" },
    }),
    db.member.findMany({
      where: { schoolId, mercurioAtivo: true, mercurioId: { not: null }, compositionItems: { none: {} } },
      select: { name: true, mercurioId: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const deVoluntario = lancamentos.filter((l) => ERRO_DO_VOLUNTARIO.test(l.lastError ?? ""));
  const deSistema = lancamentos.filter((l) => !ERRO_DO_VOLUNTARIO.test(l.lastError ?? ""));
  const situacao = { REFUSED: "recusada pelo banco", EXPIRED: "venceu sem ser aprovada", CANCELLED: "cancelada" } as Record<string, string>;

  const voluntario: Problema[] = [
    {
      id: "lancamento",
      titulo: "Pagamento recebido no Portal que não entrou no Mercúrio",
      oQueFazer:
        "O dinheiro já está na conta da escola, mas o lançamento automático parou para conferência. Lance o recibo à mão no Mercúrio com a data do pagamento, conferindo o mês da ficha, e depois clique em \"Já lancei no Mercúrio\".",
      pessoas: deVoluntario.map((l) => ({ nome: l.member.name, matricula: l.member.mercurioId, detalhe: curto(l.lastError), tarefaId: l.id })),
    },
    {
      id: "pendente",
      titulo: `Cobrança gerada há mais de ${PENDENTE_HA_DIAS} dias e não paga`,
      oQueFazer:
        "A pessoa começou o pagamento e não terminou. Fale com ela: se pagou por outro meio, dê a baixa no Mercúrio; se teve dúvida, ao abrir o pagamento no Portal ela volta para a mesma cobrança.",
      pessoas: pendentes.map((c) => ({
        nome: c.member.name,
        matricula: c.member.mercurioId,
        detalhe: `${String(c.referenceMonth).padStart(2, "0")}/${c.referenceYear} · ${c.billingType === "CREDIT_CARD" ? "cartão" : "Pix"} · gerada em ${dia(c.createdAt)}`,
      })),
    },
    {
      id: "debito",
      titulo: "Débito automático que deixou de funcionar",
      oQueFazer:
        "Avise a pessoa: este mês ela paga pelo Pix ou cartão no Portal e, se quiser, ativa o débito automático de novo em Contribuição. Recusa pelo banco costuma ser limite do Pix ou autorização não confirmada no app do banco.",
      pessoas: debitos.map((m) => ({ nome: m.name, matricula: m.mercurioId, detalhe: `Autorização ${situacao[m.pixAutomaticStatus ?? ""] ?? m.pixAutomaticStatus}` })),
    },
    {
      id: "composicao",
      titulo: "Sem composição de contribuição",
      oQueFazer:
        "Sem composição, o Portal não tem o que cobrar e a pessoa vê \"composição vazia\". Cadastre a composição no Mercúrio; ela chega ao Portal na importação seguinte.",
      pessoas: semComposicao.map((m) => ({ nome: m.name, matricula: m.mercurioId, detalhe: "Composição vazia" })),
    },
  ].filter((p) => p.pessoas.length);

  const sistema: Problema[] = deSistema.length
    ? [
        {
          id: "lancamento-sistema",
          titulo: "Lançamento automático no Mercúrio com erro de sistema",
          oQueFazer: "Não precisa fazer nada: o administrador do Portal já recebe esta lista.",
          pessoas: deSistema.map((l) => ({ nome: l.member.name, matricula: l.member.mercurioId, detalhe: curto(l.lastError) })),
        },
      ]
    : [];
  return { voluntario, sistema };
}

/** Mensagens que o aluno pode ver ao pagar e quem resolve (guia da Economia). */
export const GUIA_MENSAGENS: { mensagem: string; quem: "voluntario" | "sistema"; oQueFazer: string }[] = [
  { mensagem: "Composição da contribuição está vazia — nada a cobrar.", quem: "voluntario", oQueFazer: "Cadastrar a composição no Mercúrio." },
  { mensagem: "Regularize primeiro a contribuição de MM/AAAA…", quem: "voluntario", oQueFazer: "Há um mês mais antigo em aberto. Se ele já foi pago ou deve ser isento, acerte a ficha no Mercúrio; se não, oriente a pessoa a pagar o mais antigo primeiro." },
  { mensagem: "Este mês já está pago ou isento.", quem: "voluntario", oQueFazer: "Confira a ficha no Mercúrio. Se o pagamento não aconteceu, corrija a ficha." },
  { mensagem: "A contribuição não cobre os custos de processamento.", quem: "voluntario", oQueFazer: "O valor da composição está abaixo da taxa do Pix. Revise a composição no Mercúrio." },
  { mensagem: "Sua conta ainda não está vinculada ao Fortuna — fale com a secretaria.", quem: "voluntario", oQueFazer: "A recarga do Fortuna é opcional: a pessoa pode pagar só a contribuição. Para liberar a recarga, vincule o cadastro no Fortuna." },
  { mensagem: "Pagamento no cartão não aprovado (na página do Asaas)", quem: "voluntario", oQueFazer: "É recusa da operadora do cartão. Oriente a tentar outro cartão ou pagar com Pix." },
  { mensagem: "O pagamento on-line desta escola ainda não foi liberado…", quem: "sistema", oQueFazer: "Conta Asaas da filial não ligada ou em análise. Avise o administrador do Portal." },
  { mensagem: "Pagamentos e alterações pelo Portal chegam em breve à sua filial.", quem: "sistema", oQueFazer: "A filial ainda não foi liberada para pagar pelo Portal. Avise o administrador do Portal." },
  { mensagem: "O débito automático ainda não está disponível na sua filial.", quem: "sistema", oQueFazer: "O Pix Automático não foi liberado para a filial. Avise o administrador do Portal." },
  { mensagem: "Qualquer outra mensagem de erro, ou tela que não carrega", quem: "sistema", oQueFazer: "Peça um print da tela e envie ao administrador do Portal." },
];
