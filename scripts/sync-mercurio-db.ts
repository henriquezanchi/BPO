/**
 * Sincroniza, a partir do banco de consulta do Mercúrio (cópia diária),
 * todos os membros JÁ cadastrados no Portal das filiais informadas (ou de
 * todas as que têm School.mercurioUnidade). Substitui as leituras do
 * scraper (situação mensal, composição, recibos, cadastro, cargos).
 *
 * Uso: npx tsx --env-file=.env scripts/sync-mercurio-db.ts [BGA GYN ...]
 */
import { db } from "../src/lib/db";
import { sincronizarUnidade } from "../src/lib/mercurio-db/importar";

async function main() {
  const pedidas = process.argv.slice(2);
  const unidades = pedidas.length
    ? pedidas
    : (await db.school.findMany({ where: { mercurioUnidade: { not: null } }, select: { mercurioUnidade: true } })).map((s) => s.mercurioUnidade!);

  let falhas = 0;
  for (const uni of unidades) {
    const t0 = Date.now();
    try {
      const { school, importados } = await sincronizarUnidade(uni);
      console.log(`✓ ${uni} (${school.name}): ${importados} membro(s) em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) {
      falhas++;
      console.error(`✗ ${uni}:`, (e as Error).message);
    }
  }
  if (falhas) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
