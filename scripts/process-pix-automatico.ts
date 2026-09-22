/**
 * Processa o débito automático via Pix Automático (Asaas, ver
 * src/lib/asaas/client.ts e pix-automatico-actions.ts) — dois trabalhos:
 *
 * 1. Confirma cobranças automáticas já criadas cujo pagamento ainda não foi
 *    detectado (fallback do webhook — mesmo padrão de checkChargeStatus,
 *    só que aqui ninguém está com a tela aberta pra fazer polling ativo).
 * 2. Cria a cobrança do próximo ciclo pra cada membro com autorização
 *    ATIVA, dentro da janela exigida pelo Asaas (2 a 10 dias úteis antes do
 *    vencimento) — idempotente via PaymentCharge já existente pro mês.
 *
 * Não usa Playwright/Mercúrio (API REST normal do Asaas) — seguro de rodar
 * com frequência alta. Encadeado no mesmo serviço Railway de
 * process-mercurio-queue.ts (roda a cada 10min), não precisa de serviço
 * próprio.
 *
 * Uso: npx tsx scripts/process-pix-automatico.ts
 */
import "dotenv/config";
import { asaasCreatePixAutomaticCharge, asaasGetPaymentStatus } from "../src/lib/asaas/client";
import { confirmarPagamento } from "../src/lib/asaas/confirm-payment";
import { calcularSplitEscola } from "../src/lib/asaas/split";
import { db } from "../src/lib/db";

const DIA_VENCIMENTO = 10;
const JANELA_MIN_DIAS_UTEIS = 2;
const JANELA_MAX_DIAS_UTEIS = 10;

function diasUteisAte(hoje: Date, alvo: Date): number {
  const cursor = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  const fim = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate()));
  let dias = 0;
  while (cursor < fim) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const diaSemana = cursor.getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
}

/** Próximo dia 10 a partir de hoje (hoje incluso, se ainda não passou do dia 10). */
function proximoVencimento(hoje: Date): { year: number; month: number; data: Date } {
  const y = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth() + 1;
  if (hoje.getUTCDate() <= DIA_VENCIMENTO) {
    return { year: y, month: m, data: new Date(Date.UTC(y, m - 1, DIA_VENCIMENTO)) };
  }
  const proximoMes = m === 12 ? 1 : m + 1;
  const proximoAno = m === 12 ? y + 1 : y;
  return { year: proximoAno, month: proximoMes, data: new Date(Date.UTC(proximoAno, proximoMes - 1, DIA_VENCIMENTO)) };
}

async function confirmarPendentes() {
  const pendentes = await db.paymentCharge.findMany({ where: { status: "pendente", autoDebito: true } });
  for (const charge of pendentes) {
    try {
      const pagamento = await asaasGetPaymentStatus(charge.asaasPaymentId);
      if (pagamento.status === "RECEIVED" || pagamento.status === "CONFIRMED") {
        await confirmarPagamento(charge.id);
        console.log(`Cobrança automática ${charge.id} confirmada como paga.`);
      }
    } catch (e) {
      console.error(`Falha ao checar cobrança automática ${charge.id}: ${(e as Error).message}`);
    }
  }
}

async function criarCicloSeguinte() {
  const hoje = new Date();
  const { year, month, data: vencimento } = proximoVencimento(hoje);
  const diasUteis = diasUteisAte(hoje, vencimento);

  if (diasUteis < JANELA_MIN_DIAS_UTEIS || diasUteis > JANELA_MAX_DIAS_UTEIS) {
    console.log(`Fora da janela de criação (${diasUteis} dias úteis até ${vencimento.toISOString().slice(0, 10)}) — nada a criar agora.`);
    return;
  }

  const membros = await db.member.findMany({
    where: { pixAutomaticStatus: "ACTIVE", pixAutomaticAuthorizationId: { not: null }, asaasCustomerId: { not: null } },
    include: { school: true },
  });
  console.log(`Membros com Pix Automático ativo: ${membros.length} — vencimento alvo ${vencimento.toISOString().slice(0, 10)} (${diasUteis} dias úteis)`);

  let criadas = 0;
  for (const membro of membros) {
    const existente = await db.paymentCharge.findFirst({ where: { memberId: membro.id, referenceYear: year, referenceMonth: month } });
    if (existente) continue; // já paga/pendente pro mês (manual ou automática) — não duplica

    const itens = await db.contributionCompositionItem.findMany({ where: { memberId: membro.id } });
    const valor = itens.reduce((soma, i) => soma + Number(i.amount), 0);
    if (valor <= 0) continue;

    try {
      const nomeMes = vencimento.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
      const split = membro.school.asaasWalletId ? [await calcularSplitEscola(valor, membro.school.asaasWalletId)] : undefined;
      const pagamento = await asaasCreatePixAutomaticCharge(
        membro.asaasCustomerId!,
        membro.pixAutomaticAuthorizationId!,
        valor,
        `Contribuição ${nomeMes}/${year} — ${membro.name}`,
        vencimento.toISOString().slice(0, 10),
        split,
      );
      await db.paymentCharge.create({
        data: {
          memberId: membro.id,
          referenceYear: year,
          referenceMonth: month,
          amount: valor,
          billingType: "PIX",
          autoDebito: true,
          asaasCustomerId: membro.asaasCustomerId!,
          asaasPaymentId: pagamento.id,
        },
      });
      criadas++;
      console.log(`${membro.name}: cobrança automática de ${valor} criada.`);
    } catch (e) {
      console.error(`${membro.name}: falha ao criar cobrança automática — ${(e as Error).message}`);
    }
  }

  console.log(`${criadas} cobrança(s) automática(s) criada(s).`);
}

async function main() {
  await confirmarPendentes();
  await criarCicloSeguinte();
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
