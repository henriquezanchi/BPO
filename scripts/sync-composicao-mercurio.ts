/**
 * Relê no Mercúrio (scraper, só leitura) a composição das contribuições dos membros ativos e grava no Portal
 * (12/11/2026). Existe porque a tabela `compaluno` do banco de consulta é cópia parada em 17/10/2026 (ver
 * src/lib/mercurio-db/frescor.ts): composições trocadas depois disso só chegam ao Portal por aqui.
 *
 * Abre a tela de composição direto pela matrícula (tes_conedit.php), sem passar pela ficha — uns 2 s por pessoa.
 * Trabalha em lotes e fecha o navegador entre eles, para não segurar a trava do scraper e atrasar a fila de
 * lançamentos (fila-mercurio).
 *
 * Só funciona nas filiais que o login do scraper administra (hoje, Barra do Garças); nas demais a tela vem vazia e o
 * script não mexe em nada.
 *
 * Uso: npx tsx --env-file=.env scripts/sync-composicao-mercurio.ts [UNIDADE ...] [--limite=N]
 *   sem unidade = todas as filiais do Portal no Mercúrio antigo. --simular mostra o que mudaria, sem gravar.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { abrirComposicao, abrirListaAtivos, abrirSessaoMercurioComRetry, lerComposicao } from "../src/lib/mercurio/browser-session";

const LOTE = 40;

async function main() {
  const args = process.argv.slice(2);
  const limite = Number(args.find((a) => a.startsWith("--limite="))?.split("=")[1] ?? 0);
  const simular = args.includes("--simular");
  const unidades = args.filter((a) => !a.startsWith("--"));
  const escolas = await db.school.findMany({
    where: { mercurioUnidade: unidades.length ? { in: unidades } : { not: null }, sistemaRegistro: { not: "mercury" } },
    select: { id: true, name: true, mercurioUnidade: true },
  });
  const membros = (
    await db.member.findMany({
      where: { schoolId: { in: escolas.map((e) => e.id) }, mercurioAtivo: true, mercurioId: { not: null } },
      select: { id: true, name: true, mercurioId: true, schoolId: true },
      orderBy: [{ schoolId: "asc" }, { mercurioId: "asc" }],
    })
  ).slice(0, limite || undefined);
  console.log(`${membros.length} membro(s) em ${escolas.length} filial(is).`);

  let mudaram = 0;
  let falhas = 0;
  for (let i = 0; i < membros.length; i += LOTE) {
    const { browser, page } = await abrirSessaoMercurioComRetry();
    try {
      // Qualquer filial com menu de CADASTRO serve de ponto de partida; a composição abre pela matrícula.
      const base = await abrirListaAtivos(page, /barra do gar/i);
      for (const m of membros.slice(i, i + LOTE)) {
        try {
          const frame = await abrirComposicao(page, base, m.mercurioId!);
          // Tela que não abriu (sem acesso, sessão caída) viria vazia e apagaria a composição: só aceita com o formulário.
          if (!(await frame.locator('select[name="cmbgrp"]').count())) throw new Error("a tela de composição não abriu");
          const itens = await lerComposicao(frame);
          // Teste de 12/11/2026: em filial que o login do scraper não administra, a tela abre com o formulário mas SEM
          // itens (Lago Sul, Recife, Brasília, Goiânia). Composição vazia nunca é aceita: seria apagar dado certo.
          if (!itens.length) throw new Error("composição veio vazia (o login do scraper enxerga esta filial?) — mantida como está");
          const antes = await db.contributionCompositionItem.findMany({ where: { memberId: m.id } });
          const assinatura = (l: { mercurioGroupId: string; amount: unknown }[]) =>
            l.map((x) => `${x.mercurioGroupId}=${Number(x.amount)}`).sort().join(";");
          if (assinatura(antes) === assinatura(itens)) continue;
          mudaram++;
          console.log(`${m.mercurioId} ${m.name}: ${assinatura(antes) || "(vazia)"} → ${assinatura(itens) || "(vazia)"}`);
          if (simular) continue;
          const grupos = itens.map((x) => x.mercurioGroupId);
          await db.$transaction([
            ...itens.map((x) =>
              db.contributionCompositionItem.upsert({
                where: { memberId_mercurioGroupId: { memberId: m.id, mercurioGroupId: x.mercurioGroupId } },
                update: { label: x.label, amount: x.amount },
                create: { memberId: m.id, mercurioGroupId: x.mercurioGroupId, label: x.label, amount: x.amount },
              }),
            ),
            // Item pedido pelo Portal e ainda na fila de escrita não some.
            db.contributionCompositionItem.deleteMany({ where: { memberId: m.id, addedViaPortal: false, mercurioGroupId: { notIn: grupos } } }),
          ]);
        } catch (e) {
          falhas++;
          console.log(`${m.mercurioId} ${m.name}: ERRO ${(e as Error).message.split("\n")[0]}`);
        }
      }
    } finally {
      await browser.close();
    }
    console.log(`… ${Math.min(i + LOTE, membros.length)}/${membros.length}`);
  }
  console.log(`\nConcluído: ${mudaram} composição(ões) ${simular ? "mudaria(m)" : "atualizada(s)"}, ${falhas} falha(s).`);
}

main()
  .catch((e) => console.error("ERRO", e))
  .finally(() => process.exit(0));
