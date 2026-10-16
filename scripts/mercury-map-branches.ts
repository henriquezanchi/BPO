/**
 * Mapeia todas as filiais distintas visíveis pela chave Mercury API —
 * não existe rota "listar filiais" na API (só /branches/{id}/staff e
 * /branches/{id}/movements, que exigem já saber o id) — então a única
 * forma de descobrir é varrer /people inteiro e coletar o branch de cada
 * pessoa. Ritmo pausado (700ms entre páginas, limit=100) pra nunca estourar
 * o rate limit de 120 req/min (achado ao vivo 2026-10-15: uma varredura sem
 * pausa bateu 429 rápido).
 *
 * Uso: npx tsx --env-file=.env scripts/mercury-map-branches.ts
 */
import { mercuryGet, type MercuryPage, type MercuryPerson } from "../src/lib/mercury/client";

async function main() {
  const branchesVistas = new Map<string, string>();
  let cursor: string | undefined;
  let paginas = 0;
  let pessoas = 0;

  do {
    const path = `/people?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
    const pagina = await (mercuryGet as <T>(p: string) => Promise<MercuryPage<T>>)<MercuryPerson>(path);
    paginas++;
    pessoas += pagina.data.length;

    for (const p of pagina.data) {
      if (p.branch) branchesVistas.set(p.branch.id, p.branch.name);
    }

    console.log(`Página ${paginas}: ${pessoas} pessoas lidas, ${branchesVistas.size} filiais distintas até agora.`);
    cursor = pagina.page.nextCursor ?? undefined;
    if (cursor) await new Promise((r) => setTimeout(r, 700));
  } while (cursor);

  console.log(`\n✅ Varredura completa: ${pessoas} pessoas, ${branchesVistas.size} filiais distintas.\n`);
  const ordenado = [...branchesVistas.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  for (const [id, name] of ordenado) console.log(`${id}\t${name}`);
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
