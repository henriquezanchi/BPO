/**
 * Sincroniza quem é Diretor(a)/Sub-Chefe de uma filial (Member.isDiretor/
 * isSubChefe) e os dados da própria unidade (School.cnpj/endereco/
 * telefone/fundação) — lidos de "Diretor > Dados da Unidade" do Mercúrio,
 * que tem MATRÍCULA de verdade pros dois papéis (cruza por matrícula, não
 * por nome, diferente de Pedagogos).
 *
 * Uso: npx tsx --env-file=.env scripts/sync-diretoria.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import { abrirDadosUnidade, abrirSessaoMercurio, lerDadosUnidade } from "../src/lib/mercurio/browser-session";

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-diretoria.ts "<mercurioFilialLabel>"');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const { browser, page } = await abrirSessaoMercurio();
  let dados: Awaited<ReturnType<typeof lerDadosUnidade>>;
  try {
    const frame = await abrirDadosUnidade(page, new RegExp(filialLabel, "i"));
    dados = await lerDadosUnidade(frame);
  } finally {
    await browser.close();
  }

  console.log(`Diretor(a): ${dados.diretorNome} (${dados.diretorMatricula})`);
  console.log(`Sub-Chefe: ${dados.subChefeNome} (${dados.subChefeMatricula})`);

  const agora = new Date();
  const dia = parseInt(dados.fundacaoDia, 10);
  const mes = parseInt(dados.fundacaoMes, 10);
  const ano = parseInt(dados.fundacaoAno, 10);
  const fundacao = dia && mes && ano ? new Date(Date.UTC(ano, mes - 1, dia)) : null;

  await db.school.update({
    where: { id: school.id },
    data: {
      cnpj: dados.cnpj || null,
      enderecoCompleto: [dados.endereco, dados.bairro, dados.cidade && dados.uf ? `${dados.cidade}/${dados.uf}` : null, dados.cep]
        .filter(Boolean)
        .join(", "),
      telefoneUnidade: dados.telefone || null,
      fundacao,
      unidadeSyncedAt: agora,
    },
  });

  // Reset-então-marca (mesmo padrão de sync-pedagogos.ts) — se a diretoria
  // mudar, quem saiu do cargo perde o acesso ao Painel do Diretor sozinho.
  await db.member.updateMany({ where: { schoolId: school.id }, data: { isDiretor: false, isSubChefe: false } });

  let vinculados = 0;
  for (const [matricula, campo] of [
    [dados.diretorMatricula, "isDiretor"],
    [dados.subChefeMatricula, "isSubChefe"],
  ] as const) {
    if (!matricula) continue;
    const membro = await db.member.findFirst({ where: { schoolId: school.id, mercurioId: matricula } });
    if (!membro) {
      console.log(`⚠ Matrícula ${matricula} (${campo}) não tem Member local ainda — rode o onboarding em lote primeiro.`);
      continue;
    }
    await db.member.update({ where: { id: membro.id }, data: { [campo]: true, direcaoSyncedAt: agora } });
    console.log(`✓ ${membro.name}: ${campo} = true`);
    vinculados++;
  }

  console.log(`\n✅ Diretoria sincronizada — ${vinculados} vínculo(s) de papel, dados da unidade atualizados.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
