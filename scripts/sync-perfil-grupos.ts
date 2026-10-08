/**
 * Sincroniza em quais listas de grupo/programa da filial cada membro
 * aparece (PROGRAMA BRANCO > Provacionistas/Membros, COMPLEMENTAR > C. de
 * Amigos/Correntinha/Távolas/Janos) — pedido do usuário 2026-10-08, usado
 * pra limitar quais rubricas de contribuição aparecem pra cada membro (ver
 * src/lib/rubrica-visibilidade.ts). Mesmo padrão de sync-active-status.ts
 * (reset-então-marca, 1 sessão por lista, filial inteira numa tabela só).
 *
 * Uso: npx tsx --env-file=.env scripts/sync-perfil-grupos.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import {
  abrirListaPorNome,
  abrirSessaoMercurioComRetry,
  listarMatriculasAtivas,
  reabrirCirculoDeAmigos,
  reabrirListaPorNome,
} from "../src/lib/mercurio/browser-session";

const inicio = Date.now();
function duracao(): string {
  return `${((Date.now() - inicio) / 60_000).toFixed(1)}min`;
}

const LISTAS = [
  { nomeLink: "Provacionistas", campo: "isProvacionista" as const },
  { nomeLink: "Membros", campo: "isMembroPrograma" as const },
  { nomeLink: "Correntinha", campo: "isCorrentinha" as const },
  { nomeLink: "Távolas", campo: "isTavolas" as const },
  { nomeLink: "Janos", campo: "isJanos" as const },
];

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-perfil-grupos.ts "<mercurioFilialLabel>"');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const membrosConhecidos = await db.member.findMany({ where: { schoolId: school.id, mercurioId: { not: null } } });
  console.log(`Membros conhecidos localmente com matrícula: ${membrosConhecidos.length}`);

  // Reset — se alguém saiu de um grupo, precisa perder o sinal também.
  await db.member.updateMany({
    where: { schoolId: school.id },
    data: { isProvacionista: false, isMembroPrograma: false, isCirculoDeAmigos: false, isCorrentinha: false, isTavolas: false, isJanos: false },
  });

  const agora = new Date();
  const matriculasPorCampo = new Map<string, Set<string>>();

  const { browser, page } = await abrirSessaoMercurioComRetry();
  try {
    // Círculo de Amigos já tem navegação própria confirmada (uni_esccir.php).
    const frameCirculo = await abrirListaPorNome(page, new RegExp(filialLabel, "i"), "C. de Amigos").catch(() =>
      reabrirCirculoDeAmigos(page),
    );
    matriculasPorCampo.set("isCirculoDeAmigos", new Set(await listarMatriculasAtivas(frameCirculo)));
    console.log(`C. de Amigos: ${matriculasPorCampo.get("isCirculoDeAmigos")!.size} matrícula(s).`);

    for (const { nomeLink, campo } of LISTAS) {
      try {
        const frame = await reabrirListaPorNome(page, nomeLink);
        const matriculas = await listarMatriculasAtivas(frame);
        matriculasPorCampo.set(campo, new Set(matriculas));
        console.log(`${nomeLink}: ${matriculas.length} matrícula(s).`);
      } catch (e) {
        console.error(`⚠ Falha ao ler "${nomeLink}" — pulando essa lista nesta rodada:`, (e as Error).message);
      }
    }
  } finally {
    await browser.close();
  }

  let atualizados = 0;
  for (const membro of membrosConhecidos) {
    const data: Record<string, boolean> = {};
    let mudou = false;
    for (const [campo, matriculas] of matriculasPorCampo) {
      const valor = matriculas.has(membro.mercurioId!);
      data[campo] = valor;
      if (valor) mudou = true;
    }
    if (!mudou) continue; // já está tudo false (reset acima) — evita update à toa
    await db.member.update({ where: { id: membro.id }, data: { ...data, perfilGruposSyncedAt: agora } });
    atualizados++;
  }

  console.log(`\n✅ ${atualizados} membro(s) com algum grupo marcado, em ${duracao()}.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(`ERRO após ${duracao()}:`, e);
    await db.$disconnect();
    process.exit(1);
  });
