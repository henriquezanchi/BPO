/**
 * Sincroniza a LISTA de recibos emitidos (ContributionReceipt) pra todos os
 * membros conhecidos de uma escola, numa sessão só de navegador — varre a
 * listagem mensal da Tesouraria (tesoura/tes_cailstr.php), que é única por
 * escola/mês (não por membro), e casa cada linha com um membro conhecido
 * pelo nome ("Interessado", texto livre digitado no pagamento — sem id
 * estruturado ali, mesmo risco de falso-positivo que abrirFichaDaListaAtivos
 * já tem por nome).
 *
 * NÃO abre o documento de cada recibo (isso é caro e só acontece sob
 * demanda, quando o membro pede pra ver/baixar um específico — ver
 * src/lib/actions/receipt-actions.ts e o taskType "buscar_recibo" na fila).
 *
 * Uso: npx tsx --env-file=.env scripts/sync-receipts.ts "<mercurioFilialLabel>" [meses=3]
 */
import { db } from "../src/lib/db";
import { abrirSessaoMercurio, abrirTelaRecibos, lerRecibosDoMes } from "../src/lib/mercurio/browser-session";

/** "14/09/2026" -> Date (meio-dia UTC pra não escorregar de dia por fuso). */
function dataBrParaData(dateBR: string): Date {
  const [dia, mes, ano] = dateBR.split("/").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

async function main() {
  const filialLabel = process.argv[2];
  const meses = parseInt(process.argv[3] ?? "3", 10);
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-receipts.ts "<mercurioFilialLabel>" [meses=3]');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name} — varrendo os últimos ${meses} mês(es)`);

  const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id, mercurioId: { not: null } } });
  console.log(`Membros conhecidos localmente com matrícula: ${membrosConhecidos.length}`);
  const membrosPorNomeRegex = membrosConhecidos.map((m) => ({ member: m, regex: new RegExp(m.name, "i") }));

  const { browser, page } = await abrirSessaoMercurio();
  let novos = 0;
  let atualizados = 0;

  try {
    const hoje = new Date();
    for (let i = 0; i < meses; i++) {
      const referencia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
      const ano = referencia.getUTCFullYear();
      const mes = referencia.getUTCMonth() + 1;
      const frame = i === 0
        ? await abrirTelaRecibos(page, new RegExp(filialLabel, "i"))
        : await abrirTelaRecibos(page, new RegExp(filialLabel, "i"), ano, mes);
      const linhas = await lerRecibosDoMes(frame);
      console.log(`Mês ${ano}-${String(mes).padStart(2, "0")}: ${linhas.length} recibo(s) na filial.`);

      for (const linha of linhas) {
        const achado = membrosPorNomeRegex.find((m) => m.regex.test(linha.interessado));
        if (!achado) continue;

        const existente = await db.contributionReceipt.findUnique({ where: { mercurioRecId: linha.mercurioRecId } });
        await db.contributionReceipt.upsert({
          where: { mercurioRecId: linha.mercurioRecId },
          update: { probablyCanceled: linha.provavelmenteCancelado },
          create: {
            memberId: achado.member.id,
            mercurioRecId: linha.mercurioRecId,
            issuedAt: dataBrParaData(linha.dateBR),
            amount: linha.amount,
            probablyCanceled: linha.provavelmenteCancelado,
          },
        });
        if (existente) atualizados++;
        else novos++;
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`Recibos novos: ${novos} / atualizados: ${atualizados}`);
  console.log("\n✅ Sincronização concluída.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
