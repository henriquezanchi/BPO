/**
 * Atualiza (ou cria) o card de destaque da Acrópole Play no Portal —
 * singleton (id="global"), mesmo destaque pra todo mundo. Sem UI de admin
 * por ora (pedido do usuário 2026-10-08) — atualização manual, via este
 * script, até ficar claro que precisa de algo mais frequente.
 *
 * Uso: npx tsx --env-file=.env scripts/set-acropoleplay-highlight.ts "<título>" "<descrição>" ["<url da imagem>"]
 */
import { db } from "../src/lib/db";

async function main() {
  const [titulo, descricao, imagemUrl] = process.argv.slice(2);
  if (!titulo || !descricao) {
    throw new Error('Uso: npx tsx scripts/set-acropoleplay-highlight.ts "<título>" "<descrição>" ["<url da imagem>"]');
  }

  const highlight = await db.acropolePlayHighlight.upsert({
    where: { id: "global" },
    update: { titulo, descricao, imagemUrl: imagemUrl ?? null },
    create: { id: "global", titulo, descricao, imagemUrl: imagemUrl ?? null },
  });

  console.log("✅ Destaque atualizado:", highlight);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
