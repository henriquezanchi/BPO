import { asaasCreatePixCharge, asaasGetPixQrCode } from "@/lib/asaas/client";
import { contaDaEscola } from "@/lib/asaas/conta-escola";
import { splitDoBpo } from "@/lib/asaas/split";
import { oldestOpenContribution } from "@/lib/contribution-order";
import { db } from "@/lib/db";
import { OVERDUE_STATUSES } from "@/lib/member-data";
import { avisarSemEsperar } from "@/lib/push";
import { mesPorExtenso, nomeCurtoDaFilial, primeiroNome, reais } from "@/lib/whatsapp/modelos";

/**
 * Conversa do número do financeiro (12/11/2026; demonstração do usuário "Régua de Cobrança Humanizada"):
 * - botão "Quero o código Pix" (ou mensagem "PIX"): gera, ou reaproveita, a cobrança Pix do mês mais antigo em aberto
 *   e manda o código Copia e Cola. Mesma regra do Portal: cobrança pela subconta da filial, com o split do BPO;
 * - botão "Falar com a Economia" (ou "ECONOMIA"): registra o pedido e avisa a Economia da filial pelo Portal.
 * As respostas são texto livre, dentro da janela de 24 h que a própria pessoa abriu ao responder.
 */
const PORTAL = process.env.PORTAL_URL || "https://portal-na-one.vercel.app";

/** Pessoa pelo número do WhatsApp. A Meta às vezes manda celular brasileiro sem o 9: compara DDD + 8 últimos dígitos. */
export async function membroPorTelefone(waId: string) {
  const d = waId.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return null;
  const ddd = d.slice(0, 2);
  const fim = d.slice(-8);
  const candidatos = await db.member.findMany({
    where: { mercurioAtivo: true, OR: [{ whatsapp: { contains: fim } }, { whatsappAlt: { contains: fim } }] },
    select: { id: true, whatsapp: true, whatsappAlt: true },
    take: 10,
  });
  const bate = (n: string | null) => {
    const x = (n ?? "").replace(/\D/g, "").replace(/^55/, "");
    return x.slice(0, 2) === ddd && x.slice(-8) === fim;
  };
  const achados = candidatos.filter((c) => bate(c.whatsapp) || bate(c.whatsappAlt));
  // Mesmo número em mais de uma pessoa (família): não adivinha quem é.
  return achados.length === 1 ? achados[0].id : null;
}

type Resposta = { texto: string; codigo?: string };

export async function pixPorWhatsapp(memberId: string): Promise<Resposta> {
  const m = await db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      mercurioAtivo: true,
      status: true,
      school: { select: { name: true, asaasSubaccountApiKey: true, mercurioEscrita: true } },
    },
  });
  if (!m?.mercurioAtivo) return { texto: `Não encontrei um cadastro ativo para gerar o Pix. Fale com a secretaria da sua filial ou entre no Portal: ${PORTAL}` };
  const nome = primeiroNome(m.name);
  if (!m.school.asaasSubaccountApiKey || !m.school.mercurioEscrita)
    return { texto: `${nome}, o pagamento on-line da sua filial ainda não foi liberado. Por enquanto, fale com a secretaria.` };

  const [mensal, cobrancas] = await Promise.all([
    db.contributionMonthlyStatus.findMany({ where: { memberId }, select: { year: true, month: true, status: true } }),
    db.paymentCharge.findMany({ where: { memberId, status: { in: ["pendente", "pago"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const alvo = oldestOpenContribution(mensal, cobrancas);
  if (!alvo) return { texto: `${nome}, não encontrei contribuição em aberto no seu nome. Se quiser adiantar um mês, é só entrar no Portal: ${PORTAL}` };
  const mes = mesPorExtenso(alvo.year, alvo.month);

  // Cobrança já gerada para o mês (pelo Portal ou por aqui): manda a mesma, nunca uma segunda.
  const pendente = cobrancas.find((c) => c.status === "pendente" && c.referenceYear === alvo.year && c.referenceMonth === alvo.month);
  if (pendente) {
    if (pendente.billingType === "PIX" && pendente.pixPayload)
      return { texto: `${nome}, segue o Pix da contribuição de ${mes}, no valor de ${reais(Number(pendente.amount) + Number(pendente.fortunaTopUpAmount ?? 0))}. Copie o código da próxima mensagem e cole no app do seu banco, em Pix Copia e Cola. Assim que o banco confirmar, o recibo aparece no Portal.`, codigo: pendente.pixPayload };
    return { texto: `${nome}, já existe um pagamento de ${mes} começado no cartão. Para concluir ou trocar para Pix, entre no Portal: ${PORTAL}` };
  }

  const itens = await db.contributionCompositionItem.findMany({ where: { memberId }, select: { amount: true } });
  const valor = itens.reduce((s, i) => s + Number(i.amount), 0);
  if (valor <= 0) return { texto: `${nome}, a sua composição de contribuição está vazia, então não há o que cobrar. Já avisamos a Economia da filial.` };

  // Cliente da subconta: o da última cobrança feita desde 25/10/2026 (quando tudo passou a sair pela subconta).
  const ultima = await db.paymentCharge.findFirst({ where: { memberId, createdAt: { gte: new Date("2026-10-25T00:00:00-03:00") } }, orderBy: { createdAt: "desc" }, select: { asaasCustomerId: true } });
  if (!ultima?.asaasCustomerId)
    return { texto: `${nome}, o primeiro pagamento precisa ser feito pelo Portal (é lá que confirmamos o seu CPF). Depois disso, o Pix também chega por aqui: ${PORTAL}` };

  const conta = contaDaEscola(m.school);
  const vencimento = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const descricao = `Contribuição ${mes} — ${m.name}`;
  const split = await splitDoBpo(valor, conta);
  const pagamento = await asaasCreatePixCharge(ultima.asaasCustomerId, valor, descricao, vencimento, split, conta);
  const qr = await asaasGetPixQrCode(pagamento.id, conta);
  await db.paymentCharge.create({
    data: {
      memberId,
      referenceYear: alvo.year,
      referenceMonth: alvo.month,
      amount: valor,
      billingType: "PIX",
      asaasCustomerId: ultima.asaasCustomerId,
      asaasPaymentId: pagamento.id,
      pixPayload: qr.payload,
      pixQrCodeBase64: qr.encodedImage,
      memberWasOverdue: OVERDUE_STATUSES.has(m.status),
    },
  });
  return {
    texto: `${nome}, segue o Pix da contribuição de ${mes} à Nova Acrópole ${nomeCurtoDaFilial(m.school.name)}, no valor de ${reais(valor)}. Copie o código da próxima mensagem e cole no app do seu banco, em Pix Copia e Cola. Assim que o banco confirmar, o recibo aparece no Portal.`,
    codigo: qr.payload,
  };
}

const CHAVE_CONTATOS = "whatsapp:contatos";
export type PedidoContato = { memberId: string; schoolId: string; nome: string; matricula: string | null; telefone: string; em: string; atendido?: boolean };

/** "Falar com a Economia": guarda o pedido (aparece em Economia → Cobrança on-line) e avisa a Economia pelo Portal. */
export async function pedirContatoEconomia(memberId: string, telefone: string): Promise<Resposta> {
  const m = await db.member.findUnique({ where: { id: memberId }, select: { name: true, mercurioId: true, schoolId: true } });
  if (!m) return { texto: "Não encontrei o seu cadastro. Fale com a secretaria da sua filial." };
  const linha = await db.resumoNacional.findUnique({ where: { chave: CHAVE_CONTATOS } });
  const lista = ((linha?.dados as { pedidos?: PedidoContato[] } | null)?.pedidos ?? []).filter((p) => !(p.memberId === memberId && !p.atendido));
  lista.push({ memberId, schoolId: m.schoolId, nome: m.name, matricula: m.mercurioId, telefone, em: new Date().toISOString() });
  const dados = { pedidos: lista.slice(-300) };
  await db.resumoNacional.upsert({ where: { chave: CHAVE_CONTATOS }, update: { dados, geradoEm: new Date() }, create: { chave: CHAVE_CONTATOS, dados } });
  const economia = await db.member.findMany({ where: { schoolId: m.schoolId, mercurioAtivo: true, OR: [{ isSecretarioEconomia: true }, { isDiretor: true }] }, select: { id: true } });
  avisarSemEsperar(
    economia.map((e) => e.id),
    { titulo: "Pedido de contato pelo WhatsApp", corpo: `${m.name} quer falar com a Economia sobre a contribuição.`, url: "/economia?aba=cobranca", etiqueta: `contato-${memberId}` },
  );
  return { texto: `Certo, ${primeiroNome(m.name)}! Avisamos a Economia da sua filial, que vai falar com você pelo telefone do seu cadastro.` };
}

export async function pedidosDeContato(schoolId: string): Promise<PedidoContato[]> {
  const linha = await db.resumoNacional.findUnique({ where: { chave: CHAVE_CONTATOS } });
  return ((linha?.dados as { pedidos?: PedidoContato[] } | null)?.pedidos ?? []).filter((p) => p.schoolId === schoolId && !p.atendido);
}

export async function marcarContatoAtendido(schoolId: string, memberId: string) {
  const linha = await db.resumoNacional.findUnique({ where: { chave: CHAVE_CONTATOS } });
  if (!linha) return;
  const pedidos = ((linha.dados as { pedidos?: PedidoContato[] }).pedidos ?? []).map((p) => (p.schoolId === schoolId && p.memberId === memberId ? { ...p, atendido: true } : p));
  await db.resumoNacional.update({ where: { chave: CHAVE_CONTATOS }, data: { dados: { pedidos } } });
}

export const AJUDA = `Este é o número do financeiro da Nova Acrópole. Por aqui você pode:
• responder PIX para receber o código da contribuição em aberto;
• responder ECONOMIA para pedir que a Economia da sua filial fale com você;
• responder SAIR para não receber mais estas mensagens.
Tudo isso também fica no Portal do Membro: ${PORTAL}`;
