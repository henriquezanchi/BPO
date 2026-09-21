/**
 * Sincroniza recibos emitidos (ContributionReceipt) pra todos os membros
 * conhecidos de uma escola, numa sessão só de navegador, em 2 fases:
 *
 * Fase 1 — varre a listagem mensal da Tesouraria (tesoura/tes_cailstr.php),
 * que é única por escola/mês (não por membro), casando cada linha com um
 * membro conhecido pelo nome ("Interessado", texto livre digitado no
 * pagamento — sem id estruturado ali, mesmo risco de falso-positivo que
 * abrirFichaDaListaAtivos já tem por nome). Barata: só lê a tabela, não
 * abre nenhum documento.
 *
 * Fase 2 — busca o CONTEÚDO (tes_conprt.php) só dos recibos que ainda não
 * têm (novos) ou cujo status pode ter mudado (heurística "provavelmente
 * cancelado" virou true desde a última sincronização) — é daí que vem o
 * rótulo simplificado (itemsSummary) mostrado na lista antes de abrir, e a
 * confirmação real de cancelamento. Precisa vir DEPOIS da fase 1 porque
 * abrir um documento (page.goto) navega a página inteira pra fora do
 * frameset da Tesouraria — só volta a funcionar reabrindo Tesouraria>
 * Recibos do zero, então é mais barato fazer todos os goto's de documento
 * de uma vez ao final.
 *
 * Uso: npx tsx --env-file=.env scripts/sync-receipts.ts "<mercurioFilialLabel>" [meses=3]
 */
import { db } from "../src/lib/db";
import {
  abrirSessaoMercurio,
  abrirTelaRecibos,
  extrairRubricaSimplificada,
  lerConteudoRecibo,
  lerRecibosDoMes,
  type ReciboMercurio,
} from "../src/lib/mercurio/browser-session";
import type { Member } from "@prisma/client";

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
  const candidatos: { membro: Member; linha: ReciboMercurio }[] = [];

  try {
    const hoje = new Date();
    // abrirTelaRecibos SEMPRE renavega a partir do menu de topo (CADASTRO) —
    // só funciona na 1ª chamada. Do 2º mês em diante, o frame já aberto
    // continua válido: só troca o mês via o mesmo goto que abrirTelaRecibos
    // usaria (bug real corrigido 2026-09-21, mesma classe do problema já
    // visto em reabrirListaAtivos/reabrirCirculoDeAmigos).
    let frame = await abrirTelaRecibos(page, new RegExp(filialLabel, "i"));
    for (let i = 0; i < meses; i++) {
      const referencia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
      const ano = referencia.getUTCFullYear();
      const mes = referencia.getUTCMonth() + 1;
      if (i > 0) {
        await frame.goto(`https://mercurio.oinabn.com.br/tesoura/tes_cailstr.php?pa=${ano}&pm=${mes}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(500);
      }
      const linhas = await lerRecibosDoMes(frame);
      console.log(`Mês ${ano}-${String(mes).padStart(2, "0")}: ${linhas.length} recibo(s) na filial.`);

      for (const linha of linhas) {
        const achado = membrosPorNomeRegex.find((m) => m.regex.test(linha.interessado));
        if (achado) candidatos.push({ membro: achado.member, linha });
      }
    }

    console.log(`\nRecibos de membros conhecidos: ${candidatos.length}. Buscando conteúdo dos novos/alterados...`);
    let novos = 0;
    let atualizados = 0;
    let conteudoBuscado = 0;

    for (const { membro, linha } of candidatos) {
      const existente = await db.contributionReceipt.findUnique({ where: { mercurioRecId: linha.mercurioRecId } });

      // Já temos o texto (buscado antes, por sync anterior ou pelo próprio
      // membro clicando "Ver") mas ainda falta o resumo — recalcula local,
      // sem tocar o Mercúrio de novo.
      if (existente?.rawText && !existente.itemsSummary) {
        await db.contributionReceipt.update({
          where: { mercurioRecId: linha.mercurioRecId },
          data: { itemsSummary: extrairRubricaSimplificada(existente.rawText), probablyCanceled: linha.provavelmenteCancelado },
        });
        atualizados++;
        continue;
      }

      const precisaConteudo = !existente || existente.rawText === null || (!existente.probablyCanceled && linha.provavelmenteCancelado);

      let rawText: string | undefined;
      let canceled: boolean | undefined;
      let itemsSummary: string | undefined;
      if (precisaConteudo) {
        try {
          const conteudo = await lerConteudoRecibo(page, linha.mercurioRecId);
          rawText = conteudo.rawText;
          canceled = conteudo.canceled;
          itemsSummary = extrairRubricaSimplificada(conteudo.rawText);
          conteudoBuscado++;
        } catch (e) {
          console.error(`Falha ao buscar conteúdo do recibo ${linha.mercurioRecId}:`, (e as Error).message);
        }
      }

      await db.contributionReceipt.upsert({
        where: { mercurioRecId: linha.mercurioRecId },
        update: {
          probablyCanceled: linha.provavelmenteCancelado,
          ...(rawText !== undefined ? { rawText, canceled, itemsSummary, fetchedAt: new Date() } : {}),
        },
        create: {
          memberId: membro.id,
          mercurioRecId: linha.mercurioRecId,
          issuedAt: dataBrParaData(linha.dateBR),
          amount: linha.amount,
          probablyCanceled: linha.provavelmenteCancelado,
          rawText: rawText ?? null,
          canceled: canceled ?? null,
          itemsSummary: itemsSummary ?? null,
          fetchedAt: rawText !== undefined ? new Date() : null,
        },
      });
      if (existente) atualizados++;
      else novos++;
    }

    console.log(`\nRecibos novos: ${novos} / atualizados: ${atualizados} / conteúdo buscado: ${conteudoBuscado}`);
  } finally {
    await browser.close();
  }

  console.log("\n✅ Sincronização concluída.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
