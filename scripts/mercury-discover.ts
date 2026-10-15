/**
 * Chamada de descoberta contra a Mercury API — só pra inspecionar o JSON
 * real de cada rota (o PDF descreve os campos em prosa, não mostra o JSON
 * literal) antes de fechar os tipos em src/lib/mercury/client.ts. Descartar
 * depois de confirmado, ou manter como smoke test manual da chave.
 *
 * Uso: npx tsx --env-file=.env scripts/mercury-discover.ts [branchId] [matricula]
 */
import {
  mercuryGetBranchStaff,
  mercuryGetClasses,
  mercuryGetContributionPlan,
  mercuryGetContributions,
  mercuryGetPeople,
  mercuryGetPerson,
  mercuryGetReceipts,
} from "../src/lib/mercury/client";

async function main() {
  const branchId = process.argv[2];
  const matricula = process.argv[3];

  console.log("=== /people (limit 3) ===");
  console.log(JSON.stringify(await mercuryGetPeople({ branchId, limit: 3 }), null, 2));

  if (matricula) {
    console.log(`\n=== /people/${matricula} ===`);
    console.log(JSON.stringify(await mercuryGetPerson(matricula), null, 2));

    console.log(`\n=== /people/${matricula}/contributions ===`);
    console.log(JSON.stringify(await mercuryGetContributions(matricula), null, 2));

    console.log(`\n=== /people/${matricula}/contribution-plan ===`);
    console.log(JSON.stringify(await mercuryGetContributionPlan(matricula), null, 2));

    console.log(`\n=== /people/${matricula}/receipts ===`);
    console.log(JSON.stringify(await mercuryGetReceipts(matricula), null, 2));
  }

  if (branchId) {
    console.log(`\n=== /branches/${branchId}/staff ===`);
    console.log(JSON.stringify(await mercuryGetBranchStaff(branchId), null, 2));
  }

  console.log("\n=== /classes (limit 3) ===");
  console.log(JSON.stringify(await mercuryGetClasses({ branchId, limit: 3 }), null, 2));
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
