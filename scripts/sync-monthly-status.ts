/**
 * Sincroniza a situação mensal real da contribuição (ContributionMonthlyStatus)
 * pra TODOS os membros conhecidos de uma escola, numa chamada só —
 * lê "Tesouraria > Cadastro > Fichas" (tesoura/tes_conficha.php), que
 * mostra a filial INTEIRA numa tabela (cor + letra por mês).
 *
 * Achado ao vivo (2026-09-18): "Ficha Anual" (tes_condeta.php, usada numa
 * versão anterior deste script) NÃO é uma fonte confiável pra atraso —
 * mostrava "EM BRANCO" pra meses que a tela de Fichas mostrava "EM ATRASO"
 * pra mesma pessoa (GESSICA FIGUEIREDO DA SILVA, comprovado com prints do
 * usuário). A tela de Fichas é a mesma que a secretaria usa pra ver quem
 * está atrasado de verdade, então é essa que manda.
 *
 * Também atualiza Member.status (visão resumida usada no resto do Portal)
 * quando encontra atraso real ou isenção total — só quando o status atual
 * NÃO é "negociando" (sem sinal disso no Mercúrio, não queremos sobrescrever
 * uma negociação em andamento registrada manualmente).
 *
 * Uso: npx tsx --env-file=.env scripts/sync-monthly-status.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import { abrirFichasContribuicao, abrirSessaoMercurio, lerFichasContribuicao } from "../src/lib/mercurio/browser-session";

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-monthly-status.ts "<mercurioFilialLabel>"');
  const ano = new Date().getUTCFullYear();

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name} — ano ${ano}`);

  const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id, mercurioId: { not: null } } });
  const membroPorMatricula = new Map(membrosConhecidos.map((m) => [m.mercurioId!, m]));
  console.log(`Membros conhecidos localmente com matrícula: ${membrosConhecidos.length}`);

  const { browser, page } = await abrirSessaoMercurio();
  let fichas: Awaited<ReturnType<typeof lerFichasContribuicao>>;
  try {
    const frame = await abrirFichasContribuicao(page, new RegExp(filialLabel, "i"));
    fichas = await lerFichasContribuicao(frame);
  } finally {
    await browser.close();
  }
  console.log(`Fichas lidas do Mercúrio: ${fichas.length}`);

  const hoje = new Date();
  let processados = 0;

  for (const ficha of fichas) {
    const membro = membroPorMatricula.get(ficha.matricula);
    if (!membro) continue; // não conhecemos essa matrícula localmente ainda (onboarding não rodou pra ela)

    await db.$transaction(
      ficha.meses.map((status, i) =>
        db.contributionMonthlyStatus.upsert({
          where: { memberId_year_month: { memberId: membro.id, year: ano, month: i + 1 } },
          update: { status, syncedAt: new Date() },
          create: { memberId: membro.id, year: ano, month: i + 1, status },
        }),
      ),
    );

    const mesesVencidos = ficha.meses.slice(0, hoje.getUTCMonth() + 1);
    const temAtraso = mesesVencidos.some((s) => s === "atrasado");
    const todosIsentos = mesesVencidos.length > 0 && mesesVencidos.every((s) => s === "isento");
    const statusDerivado = temAtraso ? "atrasado" : todosIsentos ? "isento" : "em_dia";

    if (membro.status !== "negociando" && membro.status !== statusDerivado) {
      await db.member.update({ where: { id: membro.id }, data: { status: statusDerivado } });
      console.log(`${membro.name}: status ${membro.status} -> ${statusDerivado}`);
    }
    processados++;
  }

  console.log(`\nSituação mensal sincronizada pra ${processados}/${membrosConhecidos.length} membros conhecidos.`);
  console.log("\n✅ Sincronização concluída.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
