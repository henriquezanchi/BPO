/**
 * Lê as pendências da Tesouraria do Mercúrio de todas as filiais com rótulo configurado e guarda no Portal
 * (lib/mercurio/pendencias-mercurio.ts). A rotina /api/cron/pendencias-mercurio faz o mesmo toda noite.
 * Uso: npx tsx --env-file=.env scripts/sync-pendencias-mercurio.ts
 */
import { sincronizarPendenciasMercurio } from "@/lib/mercurio/pendencias-mercurio";

sincronizarPendenciasMercurio()
  .then((r) => {
    for (const x of r) console.log(`✓ ${x.uni}: ${x.itens} pendência(s)`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("✗", (e as Error).message);
    process.exit(1);
  });
