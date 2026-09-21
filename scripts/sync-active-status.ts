/**
 * Sincroniza Member.mercurioAtivo pra TODOS os membros conhecidos de uma
 * filial, numa sessão só (lê a lista de Ativos inteira e compara com quem
 * já temos localmente) — muito mais eficiente que abrir a ficha de cada
 * aluno pra checar 1 por 1. Pensado pra rodar periodicamente (hoje manual;
 * dá pra agendar depois num cron).
 *
 * Uso: npx tsx --env-file=.env scripts/sync-active-status.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import { abrirListaAtivos, abrirSessaoMercurio, listarMatriculasAtivas, reabrirCirculoDeAmigos } from "../src/lib/mercurio/browser-session";

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-active-status.ts "<mercurioFilialLabel>"');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id, mercurioId: { not: null } } });
  console.log(`Membros conhecidos localmente com matrícula: ${membrosConhecidos.length}`);

  const { browser, page } = await abrirSessaoMercurio();
  let matriculasAtivas: string[];
  try {
    // Ativos (PROGRAMA BRANCO) + C. de Amigos — bug real corrigido
    // 2026-09-21: essa lista só olhava Ativos, então marcava os membros do
    // Círculo de Amigos como inativos (eles nunca aparecem em Ativos).
    const frameAtivos = await abrirListaAtivos(page, new RegExp(filialLabel, "i"));
    const matriculasProgramaBranco = await listarMatriculasAtivas(frameAtivos);
    const frameCirculo = await reabrirCirculoDeAmigos(page);
    const matriculasCirculo = await listarMatriculasAtivas(frameCirculo);
    matriculasAtivas = [...matriculasProgramaBranco, ...matriculasCirculo];
  } finally {
    await browser.close();
  }

  console.log(`Matrículas ativas no Mercúrio agora: ${matriculasAtivas.length}`);
  const setAtivas = new Set(matriculasAtivas);
  const agora = new Date();

  for (const membro of membrosConhecidos) {
    const ativo = setAtivas.has(membro.mercurioId!);
    if (ativo !== membro.mercurioAtivo) {
      console.log(`${membro.name} (${membro.mercurioId}): ${membro.mercurioAtivo} -> ${ativo}`);
    }
    await db.member.update({ where: { id: membro.id }, data: { mercurioAtivo: ativo, mercurioAtivoSync: agora } });
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
