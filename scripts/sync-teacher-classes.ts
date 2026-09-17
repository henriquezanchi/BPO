/**
 * Sincroniza quais turmas cada professor (isPedagogo=true) realmente dá
 * aula, lendo "Turmas > Escala de Professores" do Mercúrio (uma tabela só
 * por filial, sem matrícula — cruza com o Member local só por nome, igual
 * a scripts/onboard-filial.ts faz noutro contexto). Cria/atualiza
 * ClassGroup (1 por turma real, ex: "HILARION") e ClassMembership
 * (role=professor) pra cada match.
 *
 * Só linka professores que JÁ conhecemos localmente (isPedagogo=true) —
 * não cria Member novo a partir de um nome que apareça na escala.
 *
 * Uso: npx tsx --env-file=.env scripts/sync-teacher-classes.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import { abrirEscalaProfessores, abrirSessaoMercurio, lerEscalaProfessores } from "../src/lib/mercurio/browser-session";

function normalizar(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/sync-teacher-classes.ts "<mercurioFilialLabel>"');

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const professoresConhecidos = await db.member.findMany({ where: { schoolId: school.id, isPedagogo: true } });
  console.log(`Pedagogos conhecidos localmente: ${professoresConhecidos.map((p) => p.name).join(", ") || "(nenhum)"}`);
  const porNomeNormalizado = new Map(professoresConhecidos.map((p) => [normalizar(p.name), p]));

  const { browser, page } = await abrirSessaoMercurio();
  let escala: Awaited<ReturnType<typeof lerEscalaProfessores>>;
  try {
    const frame = await abrirEscalaProfessores(page, new RegExp(filialLabel, "i"));
    escala = await lerEscalaProfessores(frame);
  } finally {
    await browser.close();
  }

  console.log(`Linhas na Escala de Professores: ${escala.length}`);

  const nomesTurmas = [...new Set(escala.map((e) => e.turma))];
  const classGroupPorNome = new Map<string, { id: string }>();
  for (const nomeTurma of nomesTurmas) {
    const cg = await db.classGroup.upsert({
      where: { schoolId_name: { schoolId: school.id, name: nomeTurma } },
      update: { mercurioClassId: nomeTurma },
      create: { schoolId: school.id, name: nomeTurma, mercurioClassId: nomeTurma },
    });
    classGroupPorNome.set(nomeTurma, cg);
  }

  const semMatch = new Set<string>();
  let vinculosCriados = 0;
  for (const linha of escala) {
    const professor = porNomeNormalizado.get(normalizar(linha.professor));
    if (!professor) {
      semMatch.add(linha.professor);
      continue;
    }
    const classGroup = classGroupPorNome.get(linha.turma)!;
    const existente = await db.classMembership.findUnique({
      where: { classGroupId_memberId_role: { classGroupId: classGroup.id, memberId: professor.id, role: "professor" } },
    });
    if (!existente) {
      await db.classMembership.create({ data: { classGroupId: classGroup.id, memberId: professor.id, role: "professor" } });
      vinculosCriados++;
      console.log(`+ ${professor.name} <- turma "${linha.turma}" (${linha.materia})`);
    }
  }

  console.log(`\n✅ ${vinculosCriados} vínculo(s) novo(s) criado(s).`);
  if (semMatch.size > 0) {
    console.log(`⚠ Professor(es) na Escala sem Member local (isPedagogo=true) correspondente: ${[...semMatch].join(", ")}`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
