/**
 * Processa o Pix Automático e confere contribuições pendentes (lógica em src/lib/asaas/pix-automatico-ciclo.ts).
 * Em produção roda sozinho na rotina /api/cron/financeiro da Vercel; este script é para rodar à mão.
 * Uso: npx tsx --env-file=.env scripts/process-pix-automatico.ts
 */
import { confirmarContribuicoesPendentes, criarCicloPixAutomatico } from "../src/lib/asaas/pix-automatico-ciclo";
import { db } from "../src/lib/db";

async function main() {
  console.log("Contribuições pendentes:", await confirmarContribuicoesPendentes());
  console.log("Ciclo do Pix Automático:", await criarCicloPixAutomatico());
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
