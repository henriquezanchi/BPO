import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enviarModeloWhatsapp, zernioConfigurado } from "@/lib/zernio/client";
import { IDIOMA_MODELOS, MODELOS, telefoneInternacional, type NomeModelo } from "@/lib/whatsapp/modelos";

/**
 * WhatsApp do financeiro (pedido do usuário 2026-10-26): sai do número central da rede (ZERNIO_WHATSAPP_ACCOUNT_ID),
 * só com modelos de utilidade. Cada mensagem entregue custa à filial CUSTO_MENSAGEM_CENTAVOS (Meta, utilidade, Brasil:
 * US$0,0068 + câmbio e IOF ≈ R$0,04), abatido do repasse dela — ver custosDoMes. Sem a conta configurada, nada sai
 * e nada é registrado: os fluxos de pagamento seguem iguais.
 */
export const CUSTO_MENSAGEM_CENTAVOS = 4;

export const whatsappFinanceiroAtivo = () => zernioConfigurado() && !!process.env.ZERNIO_WHATSAPP_ACCOUNT_ID;

export type EnvioFinanceiro = {
  schoolId: string;
  memberId?: string | null;
  telefone: string | null | undefined;
  modelo: NomeModelo;
  parametros: string[];
  /** Chave única do aviso: o mesmo aviso nunca sai duas vezes (webhook e conferência podem chegar juntos). */
  referencia: string;
};

export type ResultadoEnvio = { status: "desligado" | "repetida" | "ignorada" | "enviada" | "falhou"; erro?: string };

export async function enviarWhatsappFinanceiro(e: EnvioFinanceiro): Promise<ResultadoEnvio> {
  if (!whatsappFinanceiroAtivo()) return { status: "desligado" };
  if (e.parametros.length !== (MODELOS[e.modelo].texto.match(/\{\{\d+\}\}/g)?.length ?? 0)) throw new Error(`Parâmetros errados para o modelo ${e.modelo}.`);
  const telefone = telefoneInternacional(e.telefone);
  const saiu = telefone ? await db.whatsappDescadastro.findUnique({ where: { telefone } }) : null;
  const motivo = !telefone ? "Sem celular válido no cadastro." : saiu ? "A pessoa pediu para sair da lista." : null;

  let envioId: string;
  try {
    const criado = await db.whatsappEnvio.create({
      data: { schoolId: e.schoolId, memberId: e.memberId ?? null, telefone: telefone ?? "", modelo: e.modelo, referencia: e.referencia, status: motivo ? "ignorada" : "pendente", erro: motivo },
    });
    envioId = criado.id;
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return { status: "repetida" };
    throw erro;
  }
  if (motivo) return { status: "ignorada", erro: motivo };

  try {
    const r = await enviarModeloWhatsapp({ accountId: process.env.ZERNIO_WHATSAPP_ACCOUNT_ID!, telefone: telefone!, modelo: e.modelo, idioma: IDIOMA_MODELOS, parametros: e.parametros });
    await db.whatsappEnvio.update({ where: { id: envioId }, data: { status: "enviada", enviadaEm: new Date(), zernioMessageId: r.messageId } });
    return { status: "enviada" };
  } catch (erro) {
    const msg = (erro as Error).message.slice(0, 500);
    await db.whatsappEnvio.update({ where: { id: envioId }, data: { status: "falhou", erro: msg } });
    return { status: "falhou", erro: msg };
  }
}

/** Para os fluxos de pagamento: um problema no WhatsApp nunca derruba a confirmação de um pagamento. */
export function avisarFinanceiroSemEsperar(e: EnvioFinanceiro) {
  return enviarWhatsappFinanceiro(e).catch((erro) => {
    console.error("Falha no WhatsApp do financeiro:", erro);
    return { status: "falhou", erro: String(erro) } as ResultadoEnvio;
  });
}

/** Aviso de entrega/leitura/falha da Zernio (webhook): atualiza o envio e conta o custo quando a Meta entrega. */
export async function registrarSituacaoEnvio(messageIds: string[], evento: "message.delivered" | "message.read" | "message.failed", quando: Date, erro?: string) {
  const ids = messageIds.filter(Boolean);
  if (!ids.length) return false;
  const envio = await db.whatsappEnvio.findFirst({ where: { zernioMessageId: { in: ids } } });
  if (!envio) return false;
  if (evento === "message.failed") {
    await db.whatsappEnvio.update({ where: { id: envio.id }, data: { status: "falhou", erro: (erro ?? "Falha na entrega.").slice(0, 500), custoCentavos: 0 } });
  } else {
    await db.whatsappEnvio.update({
      where: { id: envio.id },
      data: {
        status: evento === "message.read" ? "lida" : envio.status === "lida" ? "lida" : "entregue",
        entregueEm: envio.entregueEm ?? quando,
        ...(evento === "message.read" ? { lidaEm: quando } : {}),
        custoCentavos: CUSTO_MENSAGEM_CENTAVOS,
      },
    });
  }
  return true;
}

/** Pedido de saída (resposta "SAIR"): o telefone não recebe mais nada do financeiro. */
export async function descadastrarTelefone(numero: string) {
  const telefone = telefoneInternacional(numero);
  if (!telefone) return false;
  const envio = await db.whatsappEnvio.findFirst({ where: { telefone, memberId: { not: null } }, orderBy: { createdAt: "desc" }, select: { memberId: true } });
  await db.whatsappDescadastro.upsert({ where: { telefone }, update: {}, create: { telefone, memberId: envio?.memberId ?? null } });
  return true;
}

/** Resposta "SAIR" (ou o botão "Sair da lista" dos modelos). */
export const PEDIDO_DE_SAIDA = /^\s*(sair( da lista)?|parar|pare|stop|cancelar|descadastrar)\s*[.!]?\s*$/i;

/** Mensagens e custo do mês da filial (abatido do repasse). `mes` 1-12. */
export async function custosDoMes(schoolId: string, ano: number, mes: number) {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 3));
  const fim = new Date(Date.UTC(ano, mes, 1, 3));
  const linhas = await db.whatsappEnvio.groupBy({
    by: ["modelo", "status"],
    where: { schoolId, createdAt: { gte: inicio, lt: fim } },
    _count: true,
    _sum: { custoCentavos: true },
  });
  const porModelo = new Map<string, { enviadas: number; entregues: number; centavos: number }>();
  let centavos = 0;
  let entregues = 0;
  let falhas = 0;
  for (const l of linhas) {
    const m = porModelo.get(l.modelo) ?? { enviadas: 0, entregues: 0, centavos: 0 };
    if (l.status !== "ignorada") m.enviadas += l._count;
    if (l.status === "entregue" || l.status === "lida") {
      m.entregues += l._count;
      entregues += l._count;
    }
    if (l.status === "falhou") falhas += l._count;
    m.centavos += l._sum.custoCentavos ?? 0;
    centavos += l._sum.custoCentavos ?? 0;
    porModelo.set(l.modelo, m);
  }
  return { centavos, entregues, falhas, porModelo: [...porModelo.entries()].map(([modelo, v]) => ({ modelo, ...v })) };
}
