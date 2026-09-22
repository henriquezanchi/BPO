/**
 * Correção retroativa (2026-09-22): `notificationDisabled: true` na criação
 * do cliente Asaas não é suficiente sozinho pra impedir notificações —
 * confirmado ao vivo que o Asaas cria 8 regras padrão por cliente
 * (PAYMENT_CREATED etc.) já habilitadas, independente desse flag (ver
 * comentário em asaas/client.ts). Isso mandou pelo menos 1 e-mail real em
 * nome da conta do BPO (não da escola) pro aluno. Este script passa por
 * todo cliente Asaas já criado pelo Portal (PaymentCharge + FortunaTopUpCharge)
 * e desliga as notificações de cada um — daqui pra frente, clientes novos já
 * saem desligados (asaasFindOrCreateCustomer).
 *
 * Roda uma vez só, local — usa @next/env (não dotenv/config) porque
 * ASAAS_API_KEY no .env vem escapado (`\$aact_prod_...`) especificamente pra
 * expansão do Next; dotenv/config não desfaz esse escape e manda uma chave
 * quebrada (confirmado ao vivo — 401 "chave de API inválida").
 *
 * Uso: npx tsx scripts/disable-asaas-customer-notifications.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { asaasDisableCustomerNotifications } = await import("../src/lib/asaas/client");
  const { db } = await import("../src/lib/db");

  const [cobrancas, recargas] = await Promise.all([
    db.paymentCharge.findMany({ select: { asaasCustomerId: true }, distinct: ["asaasCustomerId"] }),
    db.fortunaTopUpCharge.findMany({ select: { asaasCustomerId: true }, distinct: ["asaasCustomerId"] }),
  ]);
  const clientIds = [...new Set([...cobrancas, ...recargas].map((c) => c.asaasCustomerId))];
  console.log(`Clientes Asaas únicos encontrados: ${clientIds.length}`);

  let ok = 0;
  for (const id of clientIds) {
    try {
      await asaasDisableCustomerNotifications(id);
      ok++;
    } catch (e) {
      console.error(`${id}: falha — ${(e as Error).message}`);
    }
  }
  console.log(`\n${ok}/${clientIds.length} clientes com notificações desligadas.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
