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
import {
  abrirComposicao,
  abrirFichaDaListaAtivos,
  abrirListaAtivos,
  abrirSessaoMercurioComRetry,
  dataBRParaData,
  lerCatalogoItensDisponiveis,
  lerComposicao,
  lerCursosIntegracao,
  lerHistorico,
  reabrirListaAtivos,
} from "../src/lib/mercurio/browser-session";
import { diaMesAnoParaData } from "../src/lib/mercurio/playwright-adapter";

/**
 * Corrige Member.dataEntradaEscola (antes só preenchimento manual do
 * diretor) e o "baseline" aproximado de MemberLevelHistory (antes só
 * changedAt=now() na 1ª vez que o membro foi visto, ver
 * sync-monthly-status.ts) com as datas REAIS da aba HISTÓRICO do Mercúrio —
 * achado ao vivo 2026-09-30. Só corrige o baseline (nunca mexe numa
 * história já com mais de 1 registro real de mudança de nível — essa já é
 * confiável, capturada ao vivo desde 2026-09-28).
 */
async function corrigirEntradaENivel(memberId: string, historico: Awaited<ReturnType<typeof lerHistorico>>) {
  const dataIngresso = diaMesAnoParaData(historico.ingressoDia, historico.ingressoMes, historico.ingressoAno);
  if (dataIngresso) {
    await db.member.update({ where: { id: memberId }, data: { dataEntradaEscola: dataIngresso } });
  }

  if (!historico.concluiu1Nivel) return;
  const dataNivel2 = diaMesAnoParaData(historico.inicio2NivelDia, historico.inicio2NivelMes, historico.inicio2NivelAno);
  if (!dataNivel2) return;

  const historicoNiveis = await db.memberLevelHistory.findMany({ where: { memberId }, orderBy: { changedAt: "asc" } });
  if (historicoNiveis.length === 0) {
    await db.memberLevelHistory.create({ data: { memberId, nivel: "N2", changedAt: dataNivel2 } });
  } else if (historicoNiveis.length === 1 && historicoNiveis[0].nivel === "N2") {
    await db.memberLevelHistory.update({ where: { id: historicoNiveis[0].id }, data: { changedAt: dataNivel2 } });
  }
}

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-composition.ts "<mercurioFilialLabel>"');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id, mercurioId: { not: null } } });
  console.log(`Membros conhecidos localmente com matrícula: ${membrosConhecidos.length}`);

  const { browser, page } = await abrirSessaoMercurioComRetry();
  const catalogoUniao = new Map<string, string>(); // mercurioGroupId -> label
  let processados = 0;

  try {
    let frameAtivos = await abrirListaAtivos(page, new RegExp(filialLabel, "i"));

    for (const [i, membro] of membrosConhecidos.entries()) {
      try {
        if (i > 0) frameAtivos = await reabrirListaAtivos(page);
        const frameFicha = await abrirFichaDaListaAtivos(page, frameAtivos, new RegExp(membro.name, "i"));

        const historico = await lerHistorico(frameFicha);
        await corrigirEntradaENivel(membro.id, historico);

        const cursos = await lerCursosIntegracao(frameFicha);
        await db.$transaction(
          cursos.map((c) =>
            db.memberIntegrationCourse.upsert({
              where: { memberId_courseName_dateBR: { memberId: membro.id, courseName: c.curso, dateBR: c.dataBR } },
              update: { instructor: c.instrutor, courseDate: dataBRParaData(c.dataBR), syncedAt: new Date() },
              create: {
                memberId: membro.id,
                courseName: c.curso,
                dateBR: c.dataBR,
                courseDate: dataBRParaData(c.dataBR),
                instructor: c.instrutor,
              },
            }),
          ),
        );

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
