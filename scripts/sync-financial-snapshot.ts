/**
 * Gera (ou atualiza) o FinancialSnapshot do último mês FECHADO de uma
 * filial — fonte real: relatório "Movimento do Período" do Mercúrio (ver
 * mercurio/browser-session.ts#lerMovimentoSintetico), achado ao vivo
 * 2026-09-30 em resposta a "o BPO não está importando os dados do
 * Mercúrio pra Transparência" — antes a Transparência juntava tabelas
 * locais (PaymentCharge/Event/Payable+OFX), que não refletiam pagamento
 * feito direto na secretaria nem exigiam upload manual de extrato.
 *
 * Idempotente (upsert por schoolId+ano+mes) — seguro rodar todo dia junto
 * do resto do cron diário (sync-active-status + sync-composition), também
 * serve de auto-cura se uma rodada falhar.
 *
 * Uso: npx tsx --env-file=.env scripts/sync-financial-snapshot.ts "<mercurioFilialLabel>" [ano] [mes]
 * Sem ano/mes: usa o último mês fechado (mês anterior ao atual).
 */
import { db } from "../src/lib/db";
import { abrirSessaoMercurioComRetry, lerMovimentoSintetico } from "../src/lib/mercurio/browser-session";
import { construirTransparenciaDeMovimento, ultimoMesFechado } from "../src/lib/transparency-data";

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-financial-snapshot.ts "<mercurioFilialLabel>" [ano] [mes]');

  const { ano: anoPadrao, mes: mesPadrao } = ultimoMesFechado();
  const ano = process.argv[3] ? parseInt(process.argv[3], 10) : anoPadrao;
  const mes = process.argv[4] ? parseInt(process.argv[4], 10) : mesPadrao;

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name} — gerando snapshot de ${mes}/${ano}`);

  const { browser, page } = await abrirSessaoMercurioComRetry();
  let linhas;
  try {
    linhas = await lerMovimentoSintetico(page, new RegExp(filialLabel, "i"), ano, mes);
  } finally {
    await browser.close();
  }
  console.log(`Linhas do Movimento do Período: ${linhas.length}`);

  const payload = await construirTransparenciaDeMovimento(school.id, ano, mes, linhas);
  await db.financialSnapshot.upsert({
    where: { schoolId_ano_mes: { schoolId: school.id, ano, mes } },
    update: { payload, generatedAt: new Date() },
    create: { schoolId: school.id, ano, mes, payload },
  });

  console.log(
    `✅ Snapshot salvo — receita ${payload.receitaTotal.toFixed(2)}, despesa ${payload.despesaTotal.toFixed(2)}, resultado ${payload.resultado.toFixed(2)}.`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
