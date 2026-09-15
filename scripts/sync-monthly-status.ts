/**
 * Sincroniza a situação mensal real da contribuição (ContributionMonthlyStatus)
 * pra todos os membros conhecidos de uma escola, a partir da "Ficha Anual"
 * do Mercúrio (tesoura/tes_condeta.php) — diferente de Recibos/Composição,
 * essa tela é navegável direto pela matrícula, sem casar por nome.
 *
 * Também atualiza Member.status (visão resumida usada no resto do Portal)
 * quando encontra atraso real ou isenção total — só quando o status atual
 * NÃO é "negociando" (sem sinal disso no Mercúrio, não queremos sobrescrever
 * uma negociação em andamento registrada manualmente).
 *
 * Uso: npx tsx --env-file=.env scripts/sync-monthly-status.ts "<mercurioFilialLabel>" [ano=ano atual]
 */
import { db } from "../src/lib/db";
import { abrirFichaAnual, abrirSessaoMercurio, lerFichaAnual } from "../src/lib/mercurio/browser-session";

async function main() {
  const filialLabel = process.argv[2];
  const ano = parseInt(process.argv[3] ?? String(new Date().getUTCFullYear()), 10);
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-monthly-status.ts "<mercurioFilialLabel>" [ano]');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name} — ano ${ano}`);

  const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id, mercurioId: { not: null } } });
  console.log(`Membros conhecidos localmente com matrícula: ${membrosConhecidos.length}`);

  const { browser, page } = await abrirSessaoMercurio();
  const hoje = new Date();
  let processados = 0;

  try {
    for (const membro of membrosConhecidos) {
      try {
        // A navegação pra tes_condeta.php falha com ERR_ABORTED de vez em
        // quando (visto ao vivo, intermitente) — 1 retentativa resolve.
        let frame;
        try {
          frame = await abrirFichaAnual(page, new RegExp(filialLabel, "i"), membro.mercurioId!, ano);
        } catch (e) {
          if (!(e as Error).message.includes("ERR_ABORTED")) throw e;
          await page.waitForTimeout(1000);
          frame = await abrirFichaAnual(page, new RegExp(filialLabel, "i"), membro.mercurioId!, ano);
        }
        const meses = await lerFichaAnual(frame);

        await db.$transaction(
          meses.map((m) =>
            db.contributionMonthlyStatus.upsert({
              where: { memberId_year_month: { memberId: membro.id, year: ano, month: m.mes } },
              update: {
                status: m.status,
                registeredAtBR: m.registradoEmBR,
                registeredBy: m.responsavel,
                mercurioRecId: m.mercurioRecId,
                syncedAt: new Date(),
              },
              create: {
                memberId: membro.id,
                year: ano,
                month: m.mes,
                status: m.status,
                registeredAtBR: m.registradoEmBR,
                registeredBy: m.responsavel,
                mercurioRecId: m.mercurioRecId,
              },
            }),
          ),
        );

        // Deriva Member.status a partir dos meses já vencidos (mês <= mês atual, mesmo ano).
        const mesesVencidos = meses.filter((m) => ano < hoje.getUTCFullYear() || m.mes <= hoje.getUTCMonth() + 1);
        const temAtraso = mesesVencidos.some((m) => m.status === "atrasado");
        const todosIsentos = mesesVencidos.length > 0 && mesesVencidos.every((m) => m.status === "isento");
        const statusDerivado = temAtraso ? "atrasado" : todosIsentos ? "isento" : "em_dia";

        if (membro.status !== "negociando" && membro.status !== statusDerivado) {
          await db.member.update({ where: { id: membro.id }, data: { status: statusDerivado } });
          console.log(`${membro.name}: status ${membro.status} -> ${statusDerivado}`);
        }

        processados++;
      } catch (e) {
        console.error(`Falha ao sincronizar situação mensal de ${membro.name} (${membro.mercurioId}):`, (e as Error).message);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nSituação mensal sincronizada pra ${processados}/${membrosConhecidos.length} membros.`);
  console.log("\n✅ Sincronização concluída.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
