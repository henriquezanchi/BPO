/**
 * Sincroniza a composição das contribuições (ContributionCompositionItem) e
 * o catálogo de rubricas da filial (SchoolCompositionCatalogItem) pra TODOS
 * os membros conhecidos de uma escola, numa sessão só de navegador.
 *
 * Diferente de sync-active-status.ts (que lê a lista de Ativos inteira de
 * uma vez, O(1) chamadas), a composição é por aluno — precisa abrir a ficha
 * de cada membro conhecido (O(n)). O catálogo de rubricas é reconstruído
 * "de brinde" nesse mesmo passeio: cada aluno só vê no <select> os tipos
 * que AINDA NÃO tem, então a união (itens que o aluno tem + itens que o
 * <select> dele oferece), atualizada aluno a aluno, converge pro conjunto
 * completo da filial sem precisar de uma chamada dedicada.
 *
 * Pensado pra rodar periodicamente (hoje manual; dá pra agendar depois num
 * cron) — NÃO ao vivo por clique do membro no Portal (ver discussão de
 * escala: com muitas filiais/membros, live-fetch por clique faz todo mundo
 * fazer fila na mesma trava global do Mercúrio).
 *
 * Uso: npx tsx --env-file=.env scripts/sync-composition.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import { abrirComposicao, abrirFichaDaListaAtivos, abrirListaAtivos, abrirSessaoMercurio, lerCatalogoItensDisponiveis, lerComposicao, reabrirListaAtivos } from "../src/lib/mercurio/browser-session";

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-composition.ts "<mercurioFilialLabel>"');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id, mercurioId: { not: null } } });
  console.log(`Membros conhecidos localmente com matrícula: ${membrosConhecidos.length}`);

  const { browser, page } = await abrirSessaoMercurio();
  const catalogoUniao = new Map<string, string>(); // mercurioGroupId -> label
  let processados = 0;

  try {
    let frameAtivos = await abrirListaAtivos(page, new RegExp(filialLabel, "i"));

    for (const [i, membro] of membrosConhecidos.entries()) {
      try {
        if (i > 0) frameAtivos = await reabrirListaAtivos(page);
        const frameFicha = await abrirFichaDaListaAtivos(page, frameAtivos, new RegExp(membro.name, "i"));
        const frame = await abrirComposicao(page, frameFicha, membro.mercurioId!);
        const [itens, disponiveis] = await Promise.all([lerComposicao(frame), lerCatalogoItensDisponiveis(frame)]);

        for (const item of itens) catalogoUniao.set(item.mercurioGroupId, item.label);
        for (const disponivel of disponiveis) catalogoUniao.set(disponivel.value, disponivel.label);

        const existentes = await db.contributionCompositionItem.findMany({ where: { memberId: membro.id } });
        const existentesPorGrupo = new Map(existentes.map((e) => [e.mercurioGroupId, e]));
        const gruposAtuais = new Set(itens.map((i) => i.mercurioGroupId));

        await db.$transaction([
          ...itens.map((item) =>
            db.contributionCompositionItem.upsert({
              where: { memberId_mercurioGroupId: { memberId: membro.id, mercurioGroupId: item.mercurioGroupId } },
              update: { label: item.label, amount: item.amount },
              create: {
                memberId: membro.id,
                mercurioGroupId: item.mercurioGroupId,
                label: item.label,
                amount: item.amount,
                addedViaPortal: existentesPorGrupo.get(item.mercurioGroupId)?.addedViaPortal ?? false,
              },
            }),
          ),
          // Item que sumiu do Mercúrio (excluído por lá, fora do Portal) não faz mais sentido localmente.
          db.contributionCompositionItem.deleteMany({
            where: { memberId: membro.id, mercurioGroupId: { notIn: [...gruposAtuais] } },
          }),
        ]);

        processados++;
      } catch (e) {
        console.error(`Falha ao sincronizar composição de ${membro.name} (${membro.mercurioId}):`, (e as Error).message);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`Composição sincronizada pra ${processados}/${membrosConhecidos.length} membros.`);

  const agora = new Date();
  for (const [mercurioGroupId, label] of catalogoUniao) {
    await db.schoolCompositionCatalogItem.upsert({
      where: { schoolId_mercurioGroupId: { schoolId: school.id, mercurioGroupId } },
      update: { label, syncedAt: agora },
      create: { schoolId: school.id, mercurioGroupId, label, syncedAt: agora },
    });
  }
  console.log(`Catálogo de rubricas da filial: ${catalogoUniao.size} tipo(s) conhecidos.`);

  console.log("\n✅ Sincronização concluída.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
