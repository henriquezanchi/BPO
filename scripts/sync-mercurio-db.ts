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
import { gerarResumoFilial } from "../src/lib/mercurio-db/resumo-filial";
import { gerarResumoProfissoes } from "../src/lib/mercurio-db/resumo-profissoes";

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
      // Relatório do Painel do Diretor — falha aqui não derruba a sincronização.
      await gerarResumoFilial(uni, school.id).catch((e) => console.error(`  resumo ${uni}:`, (e as Error).message));
    } catch (e) {
      falhas++;
      console.error(`✗ ${uni}:`, (e as Error).message);
    }
  }
  // Profissões de toda a OINAB-N (painel nacional e Relatório da Filial).
  if (!pedidas.length) await gerarResumoProfissoes().catch((e) => console.error("  resumo de profissões:", (e as Error).message));
  if (falhas) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
