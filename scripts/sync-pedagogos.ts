/**
 * Sincroniza Member.isPedagogo pra TODOS os membros conhecidos de uma
 * filial, numa sessão só (lê "Integração > Pedagogos" da filial inteira e
 * compara com quem já temos localmente) — mesmo padrão de
 * sync-active-status.ts. Quem dá aula (INSTRUTOR ou EM FORMAÇÃO) também é
 * aluno normal em outras turmas — isPedagogo só libera o botão "Área do
 * Professor" no Portal, não é um papel exclusivo.
 *
 * Uso: npx tsx --env-file=.env scripts/sync-pedagogos.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import { abrirListaPedagogos, abrirSessaoMercurio, lerListaPedagogos } from "../src/lib/mercurio/browser-session";

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-pedagogos.ts "<mercurioFilialLabel>"');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id, mercurioId: { not: null } } });
  console.log(`Membros conhecidos localmente com matrícula: ${membrosConhecidos.length}`);

  const { browser, page } = await abrirSessaoMercurio();
  let pedagogos: Awaited<ReturnType<typeof lerListaPedagogos>>;
  try {
    const frame = await abrirListaPedagogos(page, new RegExp(filialLabel, "i"));
    pedagogos = await lerListaPedagogos(frame);
  } finally {
    await browser.close();
  }

  console.log(`Pedagogos no Mercúrio agora: ${pedagogos.length}`);
  const setPedagogos = new Set(pedagogos.map((p) => p.matricula));
  const agora = new Date();

  for (const membro of membrosConhecidos) {
    const isPedagogo = setPedagogos.has(membro.mercurioId!);
    if (isPedagogo !== membro.isPedagogo) {
      console.log(`${membro.name} (${membro.mercurioId}): ${membro.isPedagogo} -> ${isPedagogo}`);
    }
    await db.member.update({ where: { id: membro.id }, data: { isPedagogo, pedagogoSyncedAt: agora } });
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
