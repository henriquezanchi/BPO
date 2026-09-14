import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const school = await db.school.create({
    data: {
      name: "Nova Acrópole - Barra do Garças",
      city: "Barra do Garças",
      whatsapp: "5562991729783",
      mercurioFilialLabel: "barra do gar", // bate com "GOIÂNIA UNIVERSITARIO: BARRA DO GARÇAS" no Mercúrio
    },
  });

  const aluno = await db.member.create({
    data: {
      schoolId: school.id,
      mercurioId: "21596", // matrícula real no Mercúrio — habilita leitura/escrita real
      registrationNo: "21596",
      name: "Luiz Henrique Zanchi Borges",
      whatsapp: "5562991729783",
      email: "luiz.zanchi@email.com.br",
      status: "em_dia",
      contributions: {
        create: [
          { amount: 210, dueDate: new Date("2026-08-10"), paidAt: new Date("2026-08-10"), status: "pago" },
          { amount: 210, dueDate: new Date("2026-07-10"), paidAt: new Date("2026-07-10"), status: "pago" },
          { amount: 210, dueDate: new Date("2026-09-10"), status: "pendente" },
        ],
      },
      fortunaTx: {
        create: [{ amount: 50, type: "recarga" }, { amount: -7.5, type: "consumo", note: "Café Sophia" }],
      },
    },
  });

  const professor = await db.member.create({
    data: {
      schoolId: school.id,
      registrationNo: "10032",
      name: "Marcos Aurélio Ferreira",
      whatsapp: "5562990001111",
      email: "marcos.ferreira@email.com.br",
      status: "em_dia",
    },
  });

  const turma = await db.classGroup.create({
    data: {
      schoolId: school.id,
      name: "Curso de Filosofia - Turma A",
      memberships: {
        create: [
          { memberId: aluno.id, role: "aluno" },
          { memberId: professor.id, role: "professor" },
        ],
      },
    },
  });

  await db.activity.create({
    data: {
      classGroupId: turma.id,
      createdById: professor.id,
      type: "prova",
      title: "Prova sobre A República, de Platão",
      studyItems: "Livros I a IV, o mito da caverna",
      dueDate: new Date("2026-09-30"),
    },
  });

  await db.event.create({
    data: {
      schoolId: school.id,
      title: "A Odisseia: Quem Não Governa a Si Mesmo, Não Governa Ítaca",
      startsAt: new Date("2026-08-29T19:00:00"),
      price: 0,
    },
  });

  console.log("Seed concluído:");
  console.log(`  Aluno de teste: ${aluno.id} (${aluno.name})`);
  console.log(`  Professor de teste: ${professor.id} (${professor.name})`);
  console.log(`  Acesse o portal em /portal?memberId=${aluno.id}`);
  console.log(`  Acesse o painel do professor em /professor?memberId=${professor.id}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
