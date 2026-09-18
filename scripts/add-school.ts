/**
 * Cria a Escola (School) local de uma filial nova — primeiro passo antes
 * de qualquer sync/onboarding, já que todos os scripts de filial procuram
 * a School pelo mercurioFilialLabel.
 *
 * mercurioFilialLabel é o texto do link "CADASTRO" daquela filial no menu
 * de topo do Mercúrio (ex: "BARRA DO GAR", "GOIÂNIA SETOR OESTE") — usado
 * como regex case-insensitive, não precisa bater exato, só ser específico
 * o bastante pra não confundir com outra filial.
 *
 * Uso: npx tsx --env-file=.env scripts/add-school.ts "<nome>" "<mercurioFilialLabel>" "<whatsapp>" ["<cidade>"]
 * Ex:  npx tsx --env-file=.env scripts/add-school.ts "Nova Acrópole - Setor Oeste" "setor oeste" "5562900000000" "Goiânia"
 */
import { db } from "../src/lib/db";

async function main() {
  const [name, mercurioFilialLabel, whatsapp, city] = process.argv.slice(2);
  if (!name || !mercurioFilialLabel || !whatsapp) {
    throw new Error(
      'Uso: npx tsx scripts/add-school.ts "<nome>" "<mercurioFilialLabel>" "<whatsapp>" ["<cidade>"]',
    );
  }

  const existente = await db.school.findFirst({ where: { mercurioFilialLabel } });
  if (existente) {
    throw new Error(`Já existe uma School com mercurioFilialLabel "${mercurioFilialLabel}": ${existente.name} (${existente.id}).`);
  }

  const school = await db.school.create({ data: { name, mercurioFilialLabel, whatsapp, city: city || null } });

  console.log(`✅ Escola criada: ${school.name} (${school.id})\n`);
  console.log("Agora rode, nessa ordem (cada um numa sessão do Mercúrio — deixe 1 terminar antes do próximo):\n");
  const filial = `"${mercurioFilialLabel}"`;
  [
    `npx tsx --env-file=.env scripts/onboard-filial-lote.ts ${filial}`,
    `npx tsx --env-file=.env scripts/sync-active-status.ts ${filial}`,
    `npx tsx --env-file=.env scripts/sync-composition.ts ${filial}`,
    `npx tsx --env-file=.env scripts/sync-monthly-status.ts ${filial}`,
    `npx tsx --env-file=.env scripts/sync-pedagogos.ts ${filial}`,
    `npx tsx --env-file=.env scripts/sync-teacher-classes.ts ${filial}`,
    `npx tsx --env-file=.env scripts/sync-diretoria.ts ${filial}`,
    `npx tsx --env-file=.env scripts/sync-receipts.ts ${filial}`,
  ].forEach((cmd, i) => console.log(`${i + 1}. ${cmd}`));
  console.log(
    "\nOs 6 primeiros dependem de já ter Member local (onboard-filial-lote.ts cria) — por isso ele vem primeiro. Os demais rodam quantas vezes quiser depois, pra manter tudo atualizado.",
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
