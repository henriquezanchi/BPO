/**
 * Resolve e grava Member.fortunaClientId pra membros conhecidos, buscando
 * por nome na API do Fortuna e SÓ vinculando se e-mail ou telefone (número
 * puro, sem formatação) bater com o que já temos localmente — busca por
 * nome sozinha não é confiável o bastante pra vincular direto (nomes
 * duplicados/parciais), mas é o único filtro de busca que a API oferece.
 *
 * Uso: npx tsx --env-file=.env scripts/link-fortuna-clients.ts "<schoolId>"
 */
import { db } from "../src/lib/db";
import { fortunaSearchClientsByName, type FortunaClient } from "../src/lib/fortuna/client";

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

function bateComMembro(candidato: FortunaClient, membro: { email: string | null; whatsapp: string }): boolean {
  const emailBate = Boolean(membro.email) && candidato.email?.toLowerCase() === membro.email!.toLowerCase();
  const telefoneBate = soDigitos(candidato.cellPhone) === soDigitos(membro.whatsapp) && soDigitos(membro.whatsapp).length > 0;
  return emailBate || telefoneBate;
}

async function main() {
  const schoolId = process.argv[2];
  if (!schoolId) throw new Error('Uso: npx tsx scripts/link-fortuna-clients.ts "<schoolId>"');

  const membros = await db.member.findMany({ where: { schoolId, fortunaClientId: null } });
  console.log(`Membros sem fortunaClientId ainda: ${membros.length}`);

  let vinculados = 0;
  let semMatch = 0;

  for (const membro of membros) {
    let candidatos: FortunaClient[];
    try {
      candidatos = await fortunaSearchClientsByName(membro.name);
    } catch (e) {
      console.error(`Falha ao buscar "${membro.name}" no Fortuna:`, (e as Error).message);
      continue;
    }

    const achado = candidatos.find((c) => bateComMembro(c, membro));
    if (!achado) {
      console.log(`Sem match confiável pra ${membro.name} (${candidatos.length} candidato(s) por nome).`);
      semMatch++;
      continue;
    }

    await db.member.update({ where: { id: membro.id }, data: { fortunaClientId: achado.id } });
    console.log(`${membro.name} -> fortunaClientId ${achado.id}`);
    vinculados++;
  }

  console.log(`\nVinculados: ${vinculados} / sem match: ${semMatch}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
